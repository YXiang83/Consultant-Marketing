-- Consultant Marketing membership foundation
-- REVIEW ONLY. Do not execute until the product owner explicitly approves it.
-- This migration creates objects only in the consultant_marketing schema and does
-- not alter or reuse existing PCS tables in public.

create extension if not exists "pgcrypto";

create schema if not exists consultant_marketing;
revoke all on schema consultant_marketing from public;
grant usage on schema consultant_marketing to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Plans
-- Money is stored in sen to avoid floating-point price errors.
-- ---------------------------------------------------------------------------
create table if not exists consultant_marketing.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('trial', 'basic', 'pro')),
  name text not null,
  billing_type text not null check (billing_type in ('one_time', 'recurring')),
  initial_price_sen integer not null check (initial_price_sen >= 0),
  renewal_price_sen integer check (renewal_price_sen is null or renewal_price_sen >= 0),
  copy_limit integer not null check (copy_limit >= 0),
  image_limit integer not null check (image_limit >= 0),
  trial_days integer check (trial_days is null or trial_days > 0),
  resets_monthly boolean not null default false,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into consultant_marketing.plans (
  code,
  name,
  billing_type,
  initial_price_sen,
  renewal_price_sen,
  copy_limit,
  image_limit,
  trial_days,
  resets_monthly,
  features
)
values
  (
    'trial',
    'Trial',
    'one_time',
    8900,
    null,
    5,
    10,
    30,
    false,
    '{"content_copy":true,"sales_copy":true,"image_generation":true,"image_edit":true}'::jsonb
  ),
  (
    'basic',
    'Basic',
    'recurring',
    10900,
    8900,
    20,
    25,
    null,
    true,
    '{"content_copy":true,"sales_copy":true,"image_generation":true,"image_edit":true}'::jsonb
  ),
  (
    'pro',
    'Pro',
    'recurring',
    16900,
    10900,
    45,
    60,
    null,
    true,
    '{"content_copy":true,"sales_copy":true,"image_generation":true,"image_edit":true}'::jsonb
  )
on conflict (code) do update set
  name = excluded.name,
  billing_type = excluded.billing_type,
  initial_price_sen = excluded.initial_price_sen,
  renewal_price_sen = excluded.renewal_price_sen,
  copy_limit = excluded.copy_limit,
  image_limit = excluded.image_limit,
  trial_days = excluded.trial_days,
  resets_monthly = excluded.resets_monthly,
  features = excluded.features,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Members and current subscription state
-- Registered Supabase users without a row here are treated as pending.
-- ---------------------------------------------------------------------------
create table if not exists consultant_marketing.members (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'expired')),
  display_name text,
  phone text,
  internal_notes text,
  activated_at timestamptz,
  activated_by uuid references auth.users(id) on delete set null,
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists consultant_marketing.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_id uuid not null references consultant_marketing.plans(id),
  status text not null default 'active' check (status in ('active', 'paused', 'expired', 'canceled')),
  started_at timestamptz not null default now(),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  next_reset_at timestamptz,
  auto_renew boolean not null default false,
  activated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end > current_period_start)
);
create index if not exists cm_subscriptions_status_idx
  on consultant_marketing.subscriptions(status, current_period_end);

create table if not exists consultant_marketing.usage_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  subscription_id uuid not null unique references consultant_marketing.subscriptions(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  copy_used integer not null default 0 check (copy_used >= 0),
  image_used integer not null default 0 check (image_used >= 0),
  copy_limit integer not null default 0 check (copy_limit >= 0),
  image_limit integer not null default 0 check (image_limit >= 0),
  updated_at timestamptz not null default now(),
  check (period_end > period_start),
  check (copy_used <= copy_limit),
  check (image_used <= image_limit)
);

-- ---------------------------------------------------------------------------
-- Append-only usage and administrator audit records
-- ---------------------------------------------------------------------------
create table if not exists consultant_marketing.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid,
  event_type text not null,
  usage_kind text check (usage_kind is null or usage_kind in ('copy', 'image')),
  amount integer not null default 0 check (amount >= 0),
  provider text,
  model text,
  input_tokens integer,
  output_tokens integer,
  image_count integer,
  estimated_cost numeric(12, 6),
  request_id text,
  status text not null check (status in ('reserved', 'refunded', 'success', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists cm_usage_events_user_created_idx
  on consultant_marketing.usage_events(user_id, created_at desc);

create table if not exists consultant_marketing.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  reason text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists cm_audit_logs_subject_created_idx
  on consultant_marketing.audit_logs(subject_user_id, created_at desc);
create index if not exists cm_audit_logs_action_created_idx
  on consultant_marketing.audit_logs(action, created_at desc);

-- ---------------------------------------------------------------------------
-- Internal audit helper. Only service_role may call it through PostgREST.
-- ---------------------------------------------------------------------------
create or replace function consultant_marketing.write_audit(
  p_actor_user_id uuid,
  p_subject_user_id uuid,
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_reason text default null,
  p_before_state jsonb default null,
  p_after_state jsonb default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = consultant_marketing, public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into consultant_marketing.audit_logs (
    actor_user_id,
    subject_user_id,
    action,
    entity_type,
    entity_id,
    reason,
    before_state,
    after_state,
    metadata
  ) values (
    p_actor_user_id,
    p_subject_user_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_reason,
    p_before_state,
    p_after_state,
    coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Activate, renew, or change a plan. A plan change starts a new period.
-- ---------------------------------------------------------------------------
create or replace function consultant_marketing.activate_membership(
  p_user_id uuid,
  p_plan_code text,
  p_actor_user_id uuid,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = consultant_marketing, public, pg_temp
as $$
declare
  v_plan consultant_marketing.plans%rowtype;
  v_subscription_id uuid;
  v_now timestamptz := now();
  v_end timestamptz;
  v_before jsonb;
  v_after jsonb;
begin
  if p_plan_code not in ('trial', 'basic', 'pro') then
    raise exception 'Unsupported plan code';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'User does not exist';
  end if;

  select * into v_plan
  from consultant_marketing.plans
  where code = p_plan_code and is_active
  limit 1;

  if v_plan.id is null then
    raise exception 'Plan is not active';
  end if;

  select jsonb_build_object(
    'member', to_jsonb(m),
    'subscription', to_jsonb(s),
    'balance', to_jsonb(b)
  ) into v_before
  from consultant_marketing.members m
  left join consultant_marketing.subscriptions s on s.user_id = m.id
  left join consultant_marketing.usage_balances b on b.user_id = m.id
  where m.id = p_user_id;

  v_end := case
    when v_plan.billing_type = 'one_time' then v_now + make_interval(days => coalesce(v_plan.trial_days, 30))
    else v_now + interval '1 month'
  end;

  insert into consultant_marketing.members (
    id,
    status,
    activated_at,
    activated_by,
    paused_at,
    updated_at
  ) values (
    p_user_id,
    'active',
    v_now,
    p_actor_user_id,
    null,
    v_now
  )
  on conflict (id) do update set
    status = 'active',
    activated_at = v_now,
    activated_by = p_actor_user_id,
    paused_at = null,
    updated_at = v_now;

  insert into consultant_marketing.subscriptions (
    user_id,
    plan_id,
    status,
    started_at,
    current_period_start,
    current_period_end,
    next_reset_at,
    auto_renew,
    activated_by,
    updated_at
  ) values (
    p_user_id,
    v_plan.id,
    'active',
    v_now,
    v_now,
    v_end,
    case when v_plan.resets_monthly then v_end else null end,
    v_plan.billing_type = 'recurring',
    p_actor_user_id,
    v_now
  )
  on conflict (user_id) do update set
    plan_id = v_plan.id,
    status = 'active',
    started_at = v_now,
    current_period_start = v_now,
    current_period_end = v_end,
    next_reset_at = case when v_plan.resets_monthly then v_end else null end,
    auto_renew = v_plan.billing_type = 'recurring',
    activated_by = p_actor_user_id,
    updated_at = v_now
  returning id into v_subscription_id;

  insert into consultant_marketing.usage_balances (
    user_id,
    subscription_id,
    period_start,
    period_end,
    copy_used,
    image_used,
    copy_limit,
    image_limit,
    updated_at
  ) values (
    p_user_id,
    v_subscription_id,
    v_now,
    v_end,
    0,
    0,
    v_plan.copy_limit,
    v_plan.image_limit,
    v_now
  )
  on conflict (user_id) do update set
    subscription_id = v_subscription_id,
    period_start = v_now,
    period_end = v_end,
    copy_used = 0,
    image_used = 0,
    copy_limit = v_plan.copy_limit,
    image_limit = v_plan.image_limit,
    updated_at = v_now;

  select jsonb_build_object(
    'member', to_jsonb(m),
    'subscription', to_jsonb(s),
    'balance', to_jsonb(b),
    'plan', to_jsonb(v_plan)
  ) into v_after
  from consultant_marketing.members m
  join consultant_marketing.subscriptions s on s.user_id = m.id
  join consultant_marketing.usage_balances b on b.user_id = m.id
  where m.id = p_user_id;

  perform consultant_marketing.write_audit(
    p_actor_user_id,
    p_user_id,
    case when v_before is null then 'member_activated' else 'membership_plan_started' end,
    'subscription',
    v_subscription_id::text,
    p_reason,
    v_before,
    v_after,
    jsonb_build_object('plan_code', p_plan_code)
  );

  return v_after;
end;
$$;

create or replace function consultant_marketing.pause_membership(
  p_user_id uuid,
  p_actor_user_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = consultant_marketing, public, pg_temp
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;

  select jsonb_build_object('member', to_jsonb(m), 'subscription', to_jsonb(s))
  into v_before
  from consultant_marketing.members m
  left join consultant_marketing.subscriptions s on s.user_id = m.id
  where m.id = p_user_id;

  if v_before is null then
    raise exception 'Member does not exist';
  end if;

  update consultant_marketing.members
  set status = 'paused', paused_at = now(), updated_at = now()
  where id = p_user_id;

  update consultant_marketing.subscriptions
  set status = 'paused', updated_at = now()
  where user_id = p_user_id;

  select jsonb_build_object('member', to_jsonb(m), 'subscription', to_jsonb(s))
  into v_after
  from consultant_marketing.members m
  left join consultant_marketing.subscriptions s on s.user_id = m.id
  where m.id = p_user_id;

  perform consultant_marketing.write_audit(
    p_actor_user_id,
    p_user_id,
    'membership_paused',
    'member',
    p_user_id::text,
    p_reason,
    v_before,
    v_after,
    '{}'::jsonb
  );

  return v_after;
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
  where m.id = p_user_id;

  if v_before is null then
    raise exception 'Member does not exist';
  end if;

  if v_period_end <= now() then
    update consultant_marketing.members set status = 'expired', updated_at = now() where id = p_user_id;
    update consultant_marketing.subscriptions set status = 'expired', updated_at = now() where user_id = p_user_id;
    raise exception 'Membership period has expired; activate a new period instead';
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

  return v_after;
end;
$$;

create or replace function consultant_marketing.adjust_quota(
  p_user_id uuid,
  p_kind text,
  p_delta integer,
  p_actor_user_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = consultant_marketing, public, pg_temp
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if p_kind not in ('copy', 'image') then
    raise exception 'Unsupported quota kind';
  end if;
  if p_delta = 0 then
    raise exception 'Quota adjustment cannot be zero';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;

  select to_jsonb(b) into v_before
  from consultant_marketing.usage_balances b
  where b.user_id = p_user_id
  for update;

  if v_before is null then
    raise exception 'Usage balance does not exist';
  end if;

  if p_kind = 'copy' then
    update consultant_marketing.usage_balances
    set copy_limit = greatest(copy_used, copy_limit + p_delta), updated_at = now()
    where user_id = p_user_id;
  else
    update consultant_marketing.usage_balances
    set image_limit = greatest(image_used, image_limit + p_delta), updated_at = now()
    where user_id = p_user_id;
  end if;

  select to_jsonb(b) into v_after
  from consultant_marketing.usage_balances b
  where b.user_id = p_user_id;

  perform consultant_marketing.write_audit(
    p_actor_user_id,
    p_user_id,
    'quota_adjusted',
    'usage_balance',
    p_user_id::text,
    p_reason,
    v_before,
    v_after,
    jsonb_build_object('kind', p_kind, 'delta', p_delta)
  );

  return v_after;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic quota reservation. Monthly plans reset on their activation-day
-- anniversary. Trial expires after 30 days and never resets.
-- ---------------------------------------------------------------------------
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
         s.current_period_start,
         s.current_period_end,
         s.next_reset_at,
         p.*
  into v_member_status,
       v_subscription_id,
       v_subscription_status,
       v_period_start,
       v_period_end,
       v_next_reset,
       v_plan
  from consultant_marketing.members m
  join consultant_marketing.subscriptions s on s.user_id = m.id
  join consultant_marketing.plans p on p.id = s.plan_id
  where m.id = p_user_id
  for update of m, s;

  if v_subscription_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_subscription');
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
      update consultant_marketing.members set status = 'expired', updated_at = now() where id = p_user_id;
      update consultant_marketing.subscriptions set status = 'expired', updated_at = now() where id = v_subscription_id;
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

create or replace function consultant_marketing.refund_usage(
  p_user_id uuid,
  p_kind text,
  p_amount integer default 1,
  p_reason text default 'Generation failed'
) returns jsonb
language plpgsql
security definer
set search_path = consultant_marketing, public, pg_temp
as $$
declare
  v_balance consultant_marketing.usage_balances%rowtype;
begin
  if p_kind not in ('copy', 'image') or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_refund');
  end if;

  select * into v_balance
  from consultant_marketing.usage_balances
  where user_id = p_user_id
  for update;

  if v_balance.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_balance');
  end if;

  if p_kind = 'copy' then
    update consultant_marketing.usage_balances
    set copy_used = greatest(0, copy_used - p_amount), updated_at = now()
    where id = v_balance.id
    returning * into v_balance;
  else
    update consultant_marketing.usage_balances
    set image_used = greatest(0, image_used - p_amount), updated_at = now()
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
    'quota_refunded',
    p_kind,
    p_amount,
    'refunded',
    jsonb_build_object('reason', p_reason, 'balance_id', v_balance.id)
  );

  return jsonb_build_object(
    'ok', true,
    'remaining', jsonb_build_object(
      'copy', v_balance.copy_limit - v_balance.copy_used,
      'image', v_balance.image_limit - v_balance.image_used
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: members may read their own membership and usage. All writes are made
-- by reviewed server routes using the service role. Admin access is also
-- server-only, guarded by ADMIN_EMAIL.
-- ---------------------------------------------------------------------------
alter table consultant_marketing.plans enable row level security;
alter table consultant_marketing.members enable row level security;
alter table consultant_marketing.subscriptions enable row level security;
alter table consultant_marketing.usage_balances enable row level security;
alter table consultant_marketing.usage_events enable row level security;
alter table consultant_marketing.audit_logs enable row level security;

create policy cm_plans_authenticated_read
  on consultant_marketing.plans
  for select to authenticated
  using (is_active);

create policy cm_members_read_own
  on consultant_marketing.members
  for select to authenticated
  using (auth.uid() = id);

create policy cm_subscriptions_read_own
  on consultant_marketing.subscriptions
  for select to authenticated
  using (auth.uid() = user_id);

create policy cm_balances_read_own
  on consultant_marketing.usage_balances
  for select to authenticated
  using (auth.uid() = user_id);

create policy cm_usage_events_read_own
  on consultant_marketing.usage_events
  for select to authenticated
  using (auth.uid() = user_id);

revoke all on all tables in schema consultant_marketing from anon, authenticated;
grant select on consultant_marketing.plans to authenticated;
grant select on consultant_marketing.members to authenticated;
grant select on consultant_marketing.subscriptions to authenticated;
grant select on consultant_marketing.usage_balances to authenticated;
grant select on consultant_marketing.usage_events to authenticated;
grant all on all tables in schema consultant_marketing to service_role;
grant usage, select on all sequences in schema consultant_marketing to service_role;

revoke all on function consultant_marketing.write_audit(uuid, uuid, text, text, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function consultant_marketing.activate_membership(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function consultant_marketing.pause_membership(uuid, uuid, text) from public, anon, authenticated;
revoke all on function consultant_marketing.resume_membership(uuid, uuid, text) from public, anon, authenticated;
revoke all on function consultant_marketing.adjust_quota(uuid, text, integer, uuid, text) from public, anon, authenticated;
revoke all on function consultant_marketing.reserve_usage(uuid, text, integer) from public, anon, authenticated;
revoke all on function consultant_marketing.refund_usage(uuid, text, integer, text) from public, anon, authenticated;

grant execute on function consultant_marketing.write_audit(uuid, uuid, text, text, text, text, jsonb, jsonb, jsonb) to service_role;
grant execute on function consultant_marketing.activate_membership(uuid, text, uuid, text) to service_role;
grant execute on function consultant_marketing.pause_membership(uuid, uuid, text) to service_role;
grant execute on function consultant_marketing.resume_membership(uuid, uuid, text) to service_role;
grant execute on function consultant_marketing.adjust_quota(uuid, text, integer, uuid, text) to service_role;
grant execute on function consultant_marketing.reserve_usage(uuid, text, integer) to service_role;
grant execute on function consultant_marketing.refund_usage(uuid, text, integer, text) to service_role;

-- Required Supabase dashboard step after approval:
-- Project Settings -> API -> Exposed schemas -> add consultant_marketing.
