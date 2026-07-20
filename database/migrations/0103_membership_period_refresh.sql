-- Refresh a member's allowance period without reserving a generation credit.
-- REVIEW ONLY. Execute after 0100, 0101 and 0102 with product-owner approval.

create or replace function consultant_marketing.refresh_membership_period(
  p_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = consultant_marketing, public, pg_temp
as $$
declare
  v_member_status text;
  v_subscription_id uuid;
  v_subscription_status text;
  v_plan consultant_marketing.plans%rowtype;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_balance consultant_marketing.usage_balances%rowtype;
  v_before jsonb;
begin
  select m.status,
         s.id,
         s.status,
         s.current_period_start,
         s.current_period_end,
         p.*
  into v_member_status,
       v_subscription_id,
       v_subscription_status,
       v_period_start,
       v_period_end,
       v_plan
  from consultant_marketing.members m
  join consultant_marketing.subscriptions s on s.user_id = m.id
  join consultant_marketing.plans p on p.id = s.plan_id
  where m.id = p_user_id
  for update of m, s;

  if v_subscription_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_subscription');
  end if;

  select * into v_balance
  from consultant_marketing.usage_balances
  where user_id = p_user_id
  for update;

  if v_balance.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_balance');
  end if;

  if v_period_end > now() then
    return jsonb_build_object(
      'ok', true,
      'changed', false,
      'status', v_member_status,
      'period_end', v_period_end
    );
  end if;

  if v_plan.billing_type = 'recurring' and v_plan.resets_monthly then
    v_before := jsonb_build_object(
      'subscription_period_start', v_period_start,
      'subscription_period_end', v_period_end,
      'balance', to_jsonb(v_balance)
    );

    while v_period_end <= now() loop
      v_period_start := v_period_end;
      v_period_end := v_period_end + interval '1 month';
    end loop;

    update consultant_marketing.subscriptions
    set current_period_start = v_period_start,
        current_period_end = v_period_end,
        next_reset_at = v_period_end,
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
      v_before,
      jsonb_build_object(
        'subscription_period_start', v_period_start,
        'subscription_period_end', v_period_end,
        'balance', to_jsonb(v_balance)
      ),
      jsonb_build_object('plan_code', v_plan.code)
    );

    return jsonb_build_object(
      'ok', true,
      'changed', true,
      'status', 'active',
      'period_end', v_period_end
    );
  end if;

  if v_member_status <> 'expired' or v_subscription_status <> 'expired' then
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
      jsonb_build_object(
        'member_status', v_member_status,
        'subscription_status', v_subscription_status,
        'period_end', v_period_end
      ),
      jsonb_build_object(
        'member_status', 'expired',
        'subscription_status', 'expired',
        'period_end', v_period_end
      ),
      jsonb_build_object('plan_code', v_plan.code)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'changed', true,
    'status', 'expired',
    'period_end', v_period_end
  );
end;
$$;

revoke all on function consultant_marketing.refresh_membership_period(uuid)
  from public, anon, authenticated;
grant execute on function consultant_marketing.refresh_membership_period(uuid)
  to service_role;
