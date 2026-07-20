# Roadmap

## Sprint 1 (this branch)
- Auth (email + password), protected routes
- Mobile app shell + core pages: home / new / consultant / brief / result / projects / account
- AI provider interface, Mock + OpenAI, structured JSON via Zod
- Database schema + RLS + trial plan seed
- Env validation
- README + docs
- Basic Vitest test

## Sprint 2
- Real Supabase project provisioning + Vercel deployment
- OpenAI provider validated end-to-end with a live key
- Storage of generated image bytes to a Supabase bucket (not just base64)
- Publish suggestions asset in the "Strategy" tab
- Save/download image, share link
- Refresh flow when a revision is generated

## Sprint 3
- Stripe billing (plan upgrade, webhooks, entitlements)
- Multi-language content (Chinese + Malay first-class)
- Brand profile CRUD

## Sprint 4
- Canva integration via the official Canva Connect API — export copy + image into
  a new Canva design, or open a deep link. Until Canva credentials are real and
  verified, the `CanvaAdapter` stays in `not_configured` mode.
- Admin console, team accounts, moderation queue

## Explicitly deferred
- Desktop-specific dashboard
- Full device fingerprinting
- Deep animation system
