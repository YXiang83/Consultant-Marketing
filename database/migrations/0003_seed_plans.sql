-- Seed default subscription plans. Idempotent via unique code.
insert into public.subscription_plans (code, name, monthly_copy_limit, monthly_image_limit, max_active_sessions, features, is_active)
values
  ('trial',    'Trial',    10,  3,   2, '{"canva_export": false}'::jsonb, true),
  ('starter',  'Starter',  50,  20,  3, '{"canva_export": false}'::jsonb, true),
  ('pro',      'Pro',      300, 100, 5, '{"canva_export": true}'::jsonb,  true),
  ('internal', 'Internal', 100000, 100000, 10, '{"admin": true}'::jsonb, true)
on conflict (code) do update
  set name = excluded.name,
      monthly_copy_limit = excluded.monthly_copy_limit,
      monthly_image_limit = excluded.monthly_image_limit,
      max_active_sessions = excluded.max_active_sessions,
      features = excluded.features,
      updated_at = now();
