# Consultant Marketing

Mobile-first AI marketing consultant SaaS. Users answer a few simple questions and get
ready-to-publish copy, images, and a plan — no prompt engineering required.

## Stack

- Next.js 16 App Router · TypeScript strict · Tailwind CSS
- Supabase Auth · PostgreSQL · Storage
- OpenAI Responses + Images (pluggable via `AiProvider` interface)
- Vercel · GitHub · Stripe (reserved) · Canva (reserved)

## Quick start

```bash
pnpm install
cp .env.example .env.local     # fill in Supabase + (optional) OpenAI keys
pnpm dev
```

Without any real Supabase or OpenAI keys the app still loads: the `AI_PROVIDER=mock`
default produces deterministic content so the whole UI flow can be exercised.

## Scripts

- `pnpm dev` — dev server
- `pnpm build` — production build
- `pnpm lint` — ESLint
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm test` — Vitest

## Project layout

```
src/
  app/                        # Next.js routes (App Router)
    (auth)/                   # login / register / forgot / reset
    (app)/                    # authenticated area (home / new / projects / account)
    api/                      # server routes (consultant + generate)
    auth/callback|logout      # Supabase session endpoints
  components/ui/              # small shadcn-style primitives
  features/
    auth/                     # AuthForm
    generation/               # ResultView
  lib/
    ai/                       # provider interface, mock + openai, prompts, types
    supabase/                 # browser + server clients
    env.ts                    # zod-validated env
    usage.ts                  # quota checks and event logging
    canva.ts                  # CanvaAdapter stub (not wired to Canva yet)
database/
  migrations/                 # SQL migrations (apply to a NEW Supabase project)
docs/                         # PRD, ARCHITECTURE, DATABASE, AI-CONSULTANT, ...
```

## Supabase setup

The database schema and RLS policies live in `database/migrations/`. Apply them
against a **new** Supabase project named `Consultant Marketing`. Do **not** run
them against any pre-existing project — this repo owns its own database.

## Canva

Canva is intentionally **not integrated** in Sprint 1. `src/lib/canva.ts` defines
the `CanvaAdapter` interface and returns `not_configured`. Real integration
requires the Canva Connect API / Apps SDK and is tracked in `docs/ROADMAP.md`.

## What is not shipped in Sprint 1

Stripe billing, Canva integration, admin console, team accounts, desktop UI,
multiple providers, and full i18n. See `docs/ROADMAP.md`.
