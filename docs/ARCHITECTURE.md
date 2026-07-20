# Architecture

## Layers

- **App (Next.js App Router)** — routes under `src/app`. Server Components read
  data via `supabaseServer`; Client Components use `supabaseBrowser`.
- **API routes** — `src/app/api/*` handle authenticated write actions and AI calls.
- **Lib** — `src/lib/*` is the only place that touches secrets (OpenAI, service role).
- **DB** — Supabase Postgres with strict Row Level Security (see `docs/DATABASE.md`).
- **AI provider** — `AiProvider` interface (`src/lib/ai/types.ts`) with two
  implementations: `mockProvider` and `openAiProvider`. The active one is chosen
  by `AI_PROVIDER` env var at runtime. Business logic never imports the OpenAI
  SDK directly.

## Secret boundary
`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and any future Stripe/Canva secrets
live only in server-side env. The `browser.ts` Supabase client uses only public
env. `server-only` imports in `src/lib/ai/index.ts` and `src/lib/usage.ts`
enforce this at compile time.

## Session and RLS
`middleware.ts` refreshes Supabase cookies on every request and redirects
unauthenticated users to `/login`. Every row users can read/write is filtered by
`auth.uid()` policies; the service-role client is used only from server code for
operations that must bypass RLS (usage counters, audit log inserts).

## Quotas
`checkAndReserve` reads the user's latest `usage_balances` row, verifies the
requested `kind` (`copy` or `image`) has remaining budget, and increments the
counter with a compare-and-swap on the prior `*_used` value to prevent
concurrent double-spend. Failed generations refund and emit `usage_events`.

## AI call shape
Every provider method returns `{ data, usage }`. API routes:
1. `checkAndReserve` — 402 if over limit.
2. call provider.
3. persist `generated_assets`.
4. `recordUsageEvent` (success or error).
5. `refundOnFailure` on exception.

Provider outputs are Zod-validated (`marketingBriefSchema`, `generatedCopySchema`,
etc.); the OpenAI provider retries once with a stricter reminder before failing.
