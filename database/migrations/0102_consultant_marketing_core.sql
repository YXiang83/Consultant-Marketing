-- Consultant Marketing core application data
-- REVIEW ONLY. Do not execute until the product owner explicitly approves it.
-- Requires 0100 and 0101. Creates objects only in consultant_marketing.

-- ---------------------------------------------------------------------------
-- Bootstrap the single approved administrator when that auth user exists.
-- Application access also checks ADMIN_EMAIL on the server.
-- ---------------------------------------------------------------------------
insert into consultant_marketing.members (
  id,
  role,
  status,
  display_name,
  activated_at,
  updated_at
)
select
  u.id,
  'admin',
  'active',
  coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)),
  now(),
  now()
from auth.users u
where lower(u.email) = lower('xng9683@gmail.com')
on conflict (id) do update set
  role = 'admin',
  status = 'active',
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Membership-aware access predicate used by every business-data RLS policy.
-- Recurring plans remain accessible across a period boundary; reserve_usage
-- performs the atomic reset before the next generation is charged.
-- ---------------------------------------------------------------------------
create or replace function consultant_marketing.can_access_app(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = consultant_marketing, public, pg_temp
as $$
  select exists (
    select 1
    from consultant_marketing.members m
    where m.id = p_user_id
      and (
        m.role = 'admin'
        or (
          m.status = 'active'
          and exists (
            select 1
            from consultant_marketing.subscriptions s
            join consultant_marketing.plans p on p.id = s.plan_id
            where s.user_id = m.id
              and s.status = 'active'
              and (
                (p.billing_type = 'recurring' and p.resets_monthly)
                or s.current_period_end > now()
              )
          )
        )
      )
  );
$$;

revoke all on function consultant_marketing.can_access_app(uuid) from public, anon;
grant execute on function consultant_marketing.can_access_app(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Projects and consultant conversation state
-- ---------------------------------------------------------------------------
create table if not exists consultant_marketing.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled project',
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'completed', 'archived')),
  content_type text,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cm_projects_user_updated_idx
  on consultant_marketing.projects(user_id, updated_at desc);

create table if not exists consultant_marketing.consultant_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references consultant_marketing.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  current_step text not null default 'product',
  status text not null default 'active' check (status in ('active', 'ready', 'completed', 'abandoned')),
  structured_brief jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists cm_consultant_sessions_project_idx
  on consultant_marketing.consultant_sessions(project_id, updated_at desc);
create index if not exists cm_consultant_sessions_user_idx
  on consultant_marketing.consultant_sessions(user_id, updated_at desc);

create table if not exists consultant_marketing.consultant_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references consultant_marketing.consultant_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  structured_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists cm_consultant_messages_session_idx
  on consultant_marketing.consultant_messages(session_id, created_at);

-- ---------------------------------------------------------------------------
-- Generated copy, image concepts and image revisions
-- ---------------------------------------------------------------------------
create table if not exists consultant_marketing.generated_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references consultant_marketing.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null check (asset_type in ('copy', 'image', 'concept', 'publish_suggestion', 'revision')),
  version integer not null default 1 check (version > 0),
  content jsonb not null,
  storage_path text,
  prompt_snapshot text,
  model text,
  generation_status text not null default 'ready' check (generation_status in ('pending', 'ready', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists cm_generated_assets_project_idx
  on consultant_marketing.generated_assets(project_id, created_at desc);
create index if not exists cm_generated_assets_user_idx
  on consultant_marketing.generated_assets(user_id, created_at desc);

create table if not exists consultant_marketing.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_name text not null,
  description text,
  target_audience text,
  tone text,
  value_proposition text,
  preferred_colors text[] not null default '{}',
  banned_words text[] not null default '{}',
  default_cta text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cm_brand_profiles_user_idx
  on consultant_marketing.brand_profiles(user_id, updated_at desc);

-- Link membership usage events to isolated projects without touching public.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cm_usage_events_project_fk'
      and conrelid = 'consultant_marketing.usage_events'::regclass
  ) then
    alter table consultant_marketing.usage_events
      add constraint cm_usage_events_project_fk
      foreign key (project_id)
      references consultant_marketing.projects(id)
      on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RLS: an authenticated user can access only their own business data and only
-- while their membership is active. Paused/expired members cannot retrieve
-- project history by calling PostgREST directly.
-- ---------------------------------------------------------------------------
alter table consultant_marketing.projects enable row level security;
alter table consultant_marketing.consultant_sessions enable row level security;
alter table consultant_marketing.consultant_messages enable row level security;
alter table consultant_marketing.generated_assets enable row level security;
alter table consultant_marketing.brand_profiles enable row level security;

-- Projects
drop policy if exists cm_projects_select_active_own on consultant_marketing.projects;
create policy cm_projects_select_active_own
  on consultant_marketing.projects
  for select to authenticated
  using (
    auth.uid() = user_id
    and consultant_marketing.can_access_app(auth.uid())
  );

drop policy if exists cm_projects_insert_active_own on consultant_marketing.projects;
create policy cm_projects_insert_active_own
  on consultant_marketing.projects
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and consultant_marketing.can_access_app(auth.uid())
  );

drop policy if exists cm_projects_update_active_own on consultant_marketing.projects;
create policy cm_projects_update_active_own
  on consultant_marketing.projects
  for update to authenticated
  using (
    auth.uid() = user_id
    and consultant_marketing.can_access_app(auth.uid())
  )
  with check (
    auth.uid() = user_id
    and consultant_marketing.can_access_app(auth.uid())
  );

drop policy if exists cm_projects_delete_active_own on consultant_marketing.projects;
create policy cm_projects_delete_active_own
  on consultant_marketing.projects
  for delete to authenticated
  using (
    auth.uid() = user_id
    and consultant_marketing.can_access_app(auth.uid())
  );

-- Consultant sessions
drop policy if exists cm_sessions_select_active_own on consultant_marketing.consultant_sessions;
create policy cm_sessions_select_active_own
  on consultant_marketing.consultant_sessions
  for select to authenticated
  using (
    auth.uid() = user_id
    and consultant_marketing.can_access_app(auth.uid())
  );

drop policy if exists cm_sessions_insert_active_own on consultant_marketing.consultant_sessions;
create policy cm_sessions_insert_active_own
  on consultant_marketing.consultant_sessions
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and consultant_marketing.can_access_app(auth.uid())
  );

drop policy if exists cm_sessions_update_active_own on consultant_marketing.consultant_sessions;
create policy cm_sessions_update_active_own
  on consultant_marketing.consultant_sessions
  for update to authenticated
  using (
    auth.uid() = user_id
    and consultant_marketing.can_access_app(auth.uid())
  )
  with check (
    auth.uid() = user_id
    and consultant_marketing.can_access_app(auth.uid())
  );

-- Consultant messages through session ownership
drop policy if exists cm_messages_select_active_own on consultant_marketing.consultant_messages;
create policy cm_messages_select_active_own
  on consultant_marketing.consultant_messages
  for select to authenticated
  using (
    consultant_marketing.can_access_app(auth.uid())
    and exists (
      select 1
      from consultant_marketing.consultant_sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists cm_messages_insert_active_own on consultant_marketing.consultant_messages;
create policy cm_messages_insert_active_own
  on consultant_marketing.consultant_messages
  for insert to authenticated
  with check (
    consultant_marketing.can_access_app(auth.uid())
    and exists (
      select 1
      from consultant_marketing.consultant_sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  );

-- Generated assets
drop policy if exists cm_assets_select_active_own on consultant_marketing.generated_assets;
create policy cm_assets_select_active_own
  on consultant_marketing.generated_assets
  for select to authenticated
  using (
    auth.uid() = user_id
    and consultant_marketing.can_access_app(auth.uid())
  );

drop policy if exists cm_assets_insert_active_own on consultant_marketing.generated_assets;
create policy cm_assets_insert_active_own
  on consultant_marketing.generated_assets
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and consultant_marketing.can_access_app(auth.uid())
  );

-- Brand profiles
drop policy if exists cm_brand_profiles_all_active_own on consultant_marketing.brand_profiles;
create policy cm_brand_profiles_all_active_own
  on consultant_marketing.brand_profiles
  for all to authenticated
  using (
    auth.uid() = user_id
    and consultant_marketing.can_access_app(auth.uid())
  )
  with check (
    auth.uid() = user_id
    and consultant_marketing.can_access_app(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Table privileges. RLS remains the enforcement boundary for authenticated.
-- ---------------------------------------------------------------------------
revoke all on consultant_marketing.projects from anon, authenticated;
revoke all on consultant_marketing.consultant_sessions from anon, authenticated;
revoke all on consultant_marketing.consultant_messages from anon, authenticated;
revoke all on consultant_marketing.generated_assets from anon, authenticated;
revoke all on consultant_marketing.brand_profiles from anon, authenticated;

grant select, insert, update, delete on consultant_marketing.projects to authenticated;
grant select, insert, update on consultant_marketing.consultant_sessions to authenticated;
grant select, insert on consultant_marketing.consultant_messages to authenticated;
grant select, insert on consultant_marketing.generated_assets to authenticated;
grant select, insert, update, delete on consultant_marketing.brand_profiles to authenticated;

grant all on consultant_marketing.projects to service_role;
grant all on consultant_marketing.consultant_sessions to service_role;
grant all on consultant_marketing.consultant_messages to service_role;
grant all on consultant_marketing.generated_assets to service_role;
grant all on consultant_marketing.brand_profiles to service_role;
grant usage, select on all sequences in schema consultant_marketing to authenticated, service_role;

-- Required Supabase dashboard step after approval:
-- Project Settings -> API -> Exposed schemas -> add consultant_marketing.
-- Then reload PostgREST schema cache if the dashboard does not do it automatically.
