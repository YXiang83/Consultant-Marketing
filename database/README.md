# Database migrations

Apply in numeric order against a **new** Supabase project named `Consultant Marketing`:

1. `0001_init.sql` — schema
2. `0002_rls.sql` — RLS policies
3. `0003_seed_plans.sql` — subscription plan seed

You can run them from the Supabase SQL editor, or via `supabase db push` after
linking a local CLI to the new project. Do **not** apply against any pre-existing
project — this repo owns its own database.
