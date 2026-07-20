-- RLS policies. Users read/write only their own rows. Service role bypasses RLS.

alter table public.profiles              enable row level security;
alter table public.subscription_plans    enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.usage_balances        enable row level security;
alter table public.usage_events          enable row level security;
alter table public.devices               enable row level security;
alter table public.projects              enable row level security;
alter table public.consultant_sessions   enable row level security;
alter table public.consultant_messages   enable row level security;
alter table public.generated_assets      enable row level security;
alter table public.brand_profiles        enable row level security;
alter table public.audit_logs            enable row level security;

-- profiles: user reads/updates own row
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- subscription_plans: readable by everyone (plans are public config)
drop policy if exists plans_read_all on public.subscription_plans;
create policy plans_read_all on public.subscription_plans
  for select using (true);

-- subscriptions
drop policy if exists subs_select_own on public.subscriptions;
create policy subs_select_own on public.subscriptions
  for select using (auth.uid() = user_id);

-- usage_balances
drop policy if exists balances_select_own on public.usage_balances;
create policy balances_select_own on public.usage_balances
  for select using (auth.uid() = user_id);

-- usage_events
drop policy if exists events_select_own on public.usage_events;
create policy events_select_own on public.usage_events
  for select using (auth.uid() = user_id);

-- devices
drop policy if exists devices_select_own on public.devices;
create policy devices_select_own on public.devices
  for select using (auth.uid() = user_id);
drop policy if exists devices_update_own on public.devices;
create policy devices_update_own on public.devices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- projects (full CRUD by owner)
drop policy if exists projects_select_own on public.projects;
create policy projects_select_own on public.projects
  for select using (auth.uid() = user_id);
drop policy if exists projects_insert_own on public.projects;
create policy projects_insert_own on public.projects
  for insert with check (auth.uid() = user_id);
drop policy if exists projects_update_own on public.projects;
create policy projects_update_own on public.projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists projects_delete_own on public.projects;
create policy projects_delete_own on public.projects
  for delete using (auth.uid() = user_id);

-- consultant_sessions
drop policy if exists cs_select_own on public.consultant_sessions;
create policy cs_select_own on public.consultant_sessions
  for select using (auth.uid() = user_id);
drop policy if exists cs_insert_own on public.consultant_sessions;
create policy cs_insert_own on public.consultant_sessions
  for insert with check (auth.uid() = user_id);
drop policy if exists cs_update_own on public.consultant_sessions;
create policy cs_update_own on public.consultant_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- consultant_messages: through session ownership
drop policy if exists cm_select_own on public.consultant_messages;
create policy cm_select_own on public.consultant_messages
  for select using (
    exists (select 1 from public.consultant_sessions s where s.id = session_id and s.user_id = auth.uid())
  );
drop policy if exists cm_insert_own on public.consultant_messages;
create policy cm_insert_own on public.consultant_messages
  for insert with check (
    exists (select 1 from public.consultant_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

-- generated_assets
drop policy if exists ga_select_own on public.generated_assets;
create policy ga_select_own on public.generated_assets
  for select using (auth.uid() = user_id);
drop policy if exists ga_insert_own on public.generated_assets;
create policy ga_insert_own on public.generated_assets
  for insert with check (auth.uid() = user_id);

-- brand_profiles
drop policy if exists bp_all_own on public.brand_profiles;
create policy bp_all_own on public.brand_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- audit_logs: user reads own; writes only via service role
drop policy if exists audit_select_own on public.audit_logs;
create policy audit_select_own on public.audit_logs
  for select using (auth.uid() = user_id);
