-- Follow-up review fix for membership reservation and expired resume handling.
-- REVIEW ONLY. Execute together with 0100 only after product-owner approval.

create or replace function consultant_marketing.reserve_usage(
  p_user_id uuid,
  p_kind text,
  p_amount integer default 1
) returns jsonb
language plpgsql
security definer
set search_path = consultant_marketing, public, pg_temp
as $$
declare
  v_member_status text;
  v_subscription_id uuid;
  v_subscription_status text;
  v_plan_id uuid;
  v_plan consultant_marketing.plans%rowtype;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_next_reset timestamptz;
  v_balance consultant_marketing.usage_balances%rowtype;
  v_reset_before jsonb;
begin
  if p_kind not in ('copy', 'image') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_kind');
  end if;
  if p_amount <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  end if;

  select m.status,
         s.id,
         s.status,
         s.plan_id,
         s.current_period_start,
         s.current_period_end,
         s.next_reset_at
  into v_member_status,
       v_subscription_id,
       v_subscription_status,
       v_plan_id,
       v_period_start,
       v_period_end,
       v_next_reset
  from consultant_marketing.members m
  join consultant_marketing.subscriptions s on s.user_id = m.id
  where m.id = p_user_id
  for update of m, s;

  if v_subscription_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_subscription');
  end if;

  select * into v_plan
  from consultant_marketing.plans
  where id = v_plan_id;

  if v_plan.id is null then
    return jsonb_build_object('ok', false, 'reason', 'plan_not_found');
  end if;
  if v_member_status <> 'active' or v_subscription_status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'membership_inactive');
  end if;

  select * into v_balance
  from consultant_marketing.usage_balances
  where user_id = p_user_id
  for update;

  if v_balance.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_balance');
  end if;

  if v_period_end <= now() then
    if v_plan.resets_monthly then
      v_reset_before := jsonb_build_object(
        'subscription_period_start', v_period_start,
        'subscription_period_end', v_period_end,
        'balance', to_jsonb(v_balance)
      );

      while v_period_end <= now() loop
        v_period_start := v_period_end;
        v_period_end := v_period_end + interval '1 month';
      end loop;
      v_next_reset := v_period_end;

      update consultant_marketing.subscriptions
      set current_period_start = v_period_start,
          current_period_end = v_period_end,
          next_reset_at = v_next_reset,
          updated_at = now()
      where id = v_subscription_id;

      update consultant_marketing.usage_balances
      set period_start = v_period_start,
          period_end = v_period_end,
          copy_used = 0,
          image_used = 0,
          copy_limit = v_plan.copy_limit,
          image_limit = v_plan.image_limit,
          updated_at = now()
      where id = v_balance.id
      returning * into v_balance;

      perform consultant_marketing.write_audit(
        null,
        p_user_id,
        'monthly_quota_reset',
        'usage_balance',
        v_balance.id::text,
        'Automatic activation-day reset',
        v_reset_before,
        jsonb_build_object(
          'subscription_period_start', v_period_start,
          'subscription_period_end', v_period_end,
          'balance', to_jsonb(v_balance)
        ),
        jsonb_build_object('plan_code', v_plan.code)
      );
    else
      update consultant_marketing.members
      set status = 'expired', updated_at = now()
      where id = p_user_id;

      update consultant_marketing.subscriptions
      set status = 'expired', updated_at = now()
      where id = v_subscription_id;

      perform consultant_marketing.write_audit(
        null,
        p_user_id,
        'membership_expired',
        'subscription',
        v_subscription_id::text,
        'One-time period ended',
        null,
        null,
        jsonb_build_object('plan_code', v_plan.code)
      );

      return jsonb_build_object('ok', false, 'reason', 'membership_expired');
    end if;
  end if;

  if p_kind = 'copy' then
    if v_balance.copy_used + p_amount > v_balance.copy_limit then
      return jsonb_build_object('ok', false, 'reason', 'over_limit');
    end if;
    update consultant_marketing.usage_balances
    set copy_used = copy_used + p_amount, updated_at = now()
    where id = v_balance.id
    returning * into v_balance;
  else
    if v_balance.image_used + p_amount > v_balance.image_limit then
      return jsonb_build_object('ok', false, 'reason', 'over_limit');
    end if;
    update consultant_marketing.usage_balances
    set image_used = image_used + p_amount, updated_at = now()
    where id = v_balance.id
    returning * into v_balance;
  end if;

  insert into consultant_marketing.usage_events (
    user_id,
    event_type,
    usage_kind,
    amount,
    status,
    metadata
  ) values (
    p_user_id,
    'quota_reserved',
    p_kind,
    p_amount,
    'reserved',
    jsonb_build_object('balance_id', v_balance.id)
  );

  return jsonb_build_object(
    'ok', true,
    'balance_id', v_balance.id,
    'period_end', v_balance.period_end,
    'remaining', jsonb_build_object(
      'copy', v_balance.copy_limit - v_balance.copy_used,
      'image', v_balance.image_limit - v_balance.image_used
    )
  );
end;
$$;

create or replace function consultant_marketing.resume_membership(
  p_user_id uuid,
  p_actor_user_id uuid,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = consultant_marketing, public, pg_temp
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_period_end timestamptz;
begin
  select s.current_period_end,
         jsonb_build_object('member', to_jsonb(m), 'subscription', to_jsonb(s))
  into v_period_end, v_before
  from consultant_marketing.members m
  join consultant_marketing.subscriptions s on s.user_id = m.id
  where m.id = p_user_id
  for update of m, s;

  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'member_not_found');
  end if;

  if v_period_end <= now() then
    update consultant_marketing.members
    set status = 'expired', updated_at = now()
    where id = p_user_id;

    update consultant_marketing.subscriptions
    set status = 'expired', updated_at = now()
    where user_id = p_user_id;

    perform consultant_marketing.write_audit(
      p_actor_user_id,
      p_user_id,
      'membership_expired',
      'member',
      p_user_id::text,
      coalesce(p_reason, 'Resume attempted after period end'),
      v_before,
      jsonb_build_object('status', 'expired'),
      '{}'::jsonb
    );

    return jsonb_build_object('ok', false, 'reason', 'membership_expired');
  end if;

  update consultant_marketing.members
  set status = 'active', paused_at = null, updated_at = now()
  where id = p_user_id;

  update consultant_marketing.subscriptions
  set status = 'active', updated_at = now()
  where user_id = p_user_id;

  select jsonb_build_object('member', to_jsonb(m), 'subscription', to_jsonb(s))
  into v_after
  from consultant_marketing.members m
  join consultant_marketing.subscriptions s on s.user_id = m.id
  where m.id = p_user_id;

  perform consultant_marketing.write_audit(
    p_actor_user_id,
    p_user_id,
    'membership_resumed',
    'member',
    p_user_id::text,
    p_reason,
    v_before,
    v_after,
    '{}'::jsonb
  );

  return jsonb_build_object('ok', true, 'membership', v_after);
end;
$$;

revoke all on function consultant_marketing.reserve_usage(uuid, text, integer) from public, anon, authenticated;
revoke all on function consultant_marketing.resume_membership(uuid, uuid, text) from public, anon, authenticated;
grant execute on function consultant_marketing.reserve_usage(uuid, text, integer) to service_role;
grant execute on function consultant_marketing.resume_membership(uuid, uuid, text) to service_role;
