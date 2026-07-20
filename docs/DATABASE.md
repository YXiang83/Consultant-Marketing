# Database

Migrations are in `database/migrations/`, apply in order against a **new**
Supabase project.

## Tables

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users` with display name, role, language |
| `subscription_plans` | Config-driven plan definitions (`trial`, `starter`, `pro`, `internal`) |
| `subscriptions` | Per-user current plan and period |
| `usage_balances` | Rolling monthly counters (copy + image) |
| `usage_events` | Audit trail of every AI call |
| `devices` | Session summary (device hash, not raw IPs) |
| `projects` | One row per marketing project |
| `consultant_sessions` | Consultant flow state, holds the structured brief |
| `consultant_messages` | Q&A history per session |
| `generated_assets` | Copy, image, concept, revision outputs |
| `brand_profiles` | Reusable brand context per user |
| `audit_logs` | Sensitive actions |

## RLS
`0002_rls.sql` enables RLS on every table and writes owner-only policies. The
service-role key bypasses RLS and is used only from server code (usage counters,
audit inserts).

## Trigger
`handle_new_user` runs on `auth.users` insert and provisions:
- a `profiles` row
- a `subscriptions` row on the seeded `trial` plan
- a `usage_balances` row with that plan's limits
