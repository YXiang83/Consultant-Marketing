# PRD — Consultant Marketing

## Vision
A mobile-first AI marketing consultant SaaS. A small-business owner who knows
nothing about marketing or prompts can produce professional, editable marketing
content in under five minutes.

## Success metric
Non-marketing user completes the flow and produces publishable copy + image in ≤ 5 min.

## Non-goals for Sprint 1
- Stripe billing
- Canva integration (real API)
- Team accounts
- Admin console
- Desktop-specific UI
- Multi-provider support

## Core user flow
1. Sign up → land on mobile home
2. Tap "Start a new project" → pick content type
3. Consultant asks one question at a time: product, goal, audience, platforms, tone, CTA
4. Confirm the structured brief (edit anything)
5. Generate copy + image
6. Revise: shorter, longer, different tone, different audience, regenerate

## Guardrails
- No jargon in questions
- Never expose prompts or system messages to user
- Refuse illegal / fraud / medical / legal / financial-risk claims and impersonation
- No real people's likenesses in images
