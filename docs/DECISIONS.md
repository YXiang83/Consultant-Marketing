# Decisions

## D-001 — Existing GitHub repo name kept as `Consultant-Marketing`
The task called for the slug `consultant-marketing`, but the target repo
(`YXiang83/Consultant-Marketing`) already exists with capitalized name.
Rather than create a second repo (which would violate the "one project" rule),
we kept the existing repo and set the npm `name` to `consultant-marketing`.

## D-002 — Sprint 1 uses `AI_PROVIDER=mock` by default
The mock provider lets the whole UX be validated locally without an OpenAI key.
The OpenAI provider is implemented and switched on by `AI_PROVIDER=openai` +
`OPENAI_API_KEY`.

## D-003 — Zod validation with one controlled retry
LLM outputs are parsed against strict Zod schemas. If invalid, we retry once
with a stricter instruction. A second failure surfaces a plain user-facing
error; no partial or malformed JSON is written to the database.

## D-004 — Canva integration deliberately not built
Real Canva integration requires the Canva Connect API + verified OAuth
credentials. To avoid fabricating buttons that don't work, `CanvaAdapter`
returns `not_configured` and the "Export to Canva" affordance is not yet wired
into the UI.

## D-005 — Supabase project and Vercel project are prepared but not created
Creating them incurs cost and requires paid-account authorization. Migrations,
RLS, seeds, and env variable templates are ready; the user runs the create step
once, then fills `.env.local` and points Vercel at the repo.

## D-006 — Minimal shadcn-style primitives, not the full CLI
Full shadcn init is interactive and pulls a large set of files. Sprint 1 uses
four minimal primitives (`Button`, `Input`/`Textarea`, `Card`, `Label`) built
on Tailwind. Later sprints can adopt the CLI without changing the interface.

## D-007 — Compare-and-swap on `usage_balances.*_used`
Simple, no extra table. Sufficient for a single-tenant per-user counter; the
service is single-region during Sprint 1.

## D-008 — `middleware.ts` is soft on missing env
If Supabase env vars are missing, middleware calls `NextResponse.next()` rather
than throwing. Page-level guards then render a clear "Environment not
configured" screen. This lets a developer install and boot the app before
touching env.
