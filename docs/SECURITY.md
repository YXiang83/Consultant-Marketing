# Security notes

## Secrets
- All secrets are server-only: `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, future
  `STRIPE_*`, `CANVA_*`.
- `src/lib/ai/index.ts` and `src/lib/usage.ts` use `import "server-only"` so any
  accidental client import breaks the build.

## Auth and RLS
- Supabase Auth (email + password to start). Passwords minimum 8 chars.
- `middleware.ts` refreshes cookies on every request and redirects unauthenticated
  users to `/login` for anything outside a small public route list.
- Every user-owned table has RLS. Users can only touch rows where `user_id =
  auth.uid()` (or through session ownership for `consultant_messages`).
- The service-role key is used only from server code, never shipped to the browser.

## Quotas
- Copy and image credits are enforced server-side in `checkAndReserve`. The
  frontend cannot mint credits by hiding UI.
- Compare-and-swap on the `*_used` column prevents concurrent double-spend.
- Failed generations refund the credit and record an error `usage_event`.

## Content safety
- `CONSULTANT_POLICY` refuses illegal/fraudulent/medical/legal/financial-risk claims,
  impersonation, minor-inappropriate content, and copyrighted characters.
- Image prompts explicitly avoid real-people likenesses.

## User-facing errors
- User sees short human messages ("Please give an answer to continue.").
- Server logs keep model IDs, prompt tokens, request IDs. No secret is ever
  echoed back to the browser or included in a user-facing error.

## What is out of scope for Sprint 1
- IP-based blocking (spec says do not lock by IP).
- Full device fingerprinting.
- Formal admin console for revoking sessions.
