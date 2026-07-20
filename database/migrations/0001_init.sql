-- Consultant Marketing — initial schema
-- Apply against a NEW Supabase project. Do not run against any existing project.

create extension if not exists "pgcrypto";

-- =========================================================================
-- profiles: mirrors auth.users, holds display metadata
-- =========================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  preferred_language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================================
-- subscription_plans: pricing plans (config-driven, no prices hard-coded elsewhere)
-- =========================================================================
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  monthly_copy_limit integer not null default 0,
  monthly_image_limit integer not null default 0,
  max_active_sessions integer not null default 3,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================================
-- subscriptions: current subscription state per user
-- =========================================================================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'trialing' check (status in ('trialing','active','past_due','canceled','expired')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '30 days'),
  external_customer_id text,
  external_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);

-- =========================================================================
-- usage_balances: rolling monthly counters
-- =========================================================================
create table if not exists public.usage_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  copy_used integer not null default 0,
  image_used integer not null default 0,
  copy_limit integer not null default 0,
  image_limit integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, period_start)
);
create index if not exists usage_balances_user_idx on public.usage_balances(user_id, period_end desc);

-- =========================================================================
-- usage_events: audit trail of AI calls
-- =========================================================================
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid,
  event_type text not null,
  provider text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  image_count integer,
  estimated_cost numeric(10,4),
  request_id text,
  status text not null check (status in ('success','error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_created_idx on public.usage_events(user_id, created_at desc);

-- =========================================================================
-- devices: per-user active devices/sessions summary
-- =========================================================================
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_hash text not null,
  device_name text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_ip_hash text,
  is_trusted boolean not null default false,
  revoked_at timestamptz,
  unique (user_id, device_hash)
);

-- =========================================================================
-- projects: user marketing projects
-- =========================================================================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled project',
  status text not null default 'draft' check (status in ('draft','in_progress','completed','archived')),
  content_type text,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects(user_id, updated_at desc);

-- =========================================================================
-- consultant_sessions: per-project consultant flow state
-- =========================================================================
create table if not exists public.consultant_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  current_step text not null default 'content_type',
  status text not null default 'active' check (status in ('active','ready','completed','abandoned')),
  structured_brief jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists consultant_sessions_project_idx on public.consultant_sessions(project_id);

-- =========================================================================
-- consultant_messages: Q&A history
-- =========================================================================
create table if not exists public.consultant_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.consultant_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  structured_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists consultant_messages_session_idx on public.consultant_messages(session_id, created_at);

-- =========================================================================
-- generated_assets: generated copy/image/etc.
-- =========================================================================
create table if not exists public.generated_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null check (asset_type in ('copy','image','concept','publish_suggestion','revision')),
  version integer not null default 1,
  content jsonb not null,
  storage_path text,
  prompt_snapshot text,
  model text,
  generation_status text not null default 'ready' check (generation_status in ('pending','ready','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists generated_assets_project_idx on public.generated_assets(project_id, created_at desc);

-- =========================================================================
-- brand_profiles: reusable brand context
-- =========================================================================
create table if not exists public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_name text not null,
  description text,
  target_audience text,
  tone text,
  value_proposition text,
  preferred_colors text[] default '{}',
  banned_words text[] default '{}',
  default_cta text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================================
-- audit_logs: sensitive actions
-- =========================================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- On auth.users insert -> create profile + default trial subscription + balance
-- =========================================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  trial_plan uuid;
  plan_copy int;
  plan_image int;
  now_ts timestamptz := now();
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));

  select id, monthly_copy_limit, monthly_image_limit
    into trial_plan, plan_copy, plan_image
  from public.subscription_plans where code = 'trial' and is_active limit 1;

  if trial_plan is not null then
    insert into public.subscriptions(user_id, plan_id, status, current_period_start, current_period_end)
    values (new.id, trial_plan, 'trialing', now_ts, now_ts + interval '30 days');

    insert into public.usage_balances(user_id, period_start, period_end, copy_used, image_used, copy_limit, image_limit)
    values (new.id, now_ts, now_ts + interval '30 days', 0, 0, plan_copy, plan_image);
  end if;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
