# Consultant Marketing Membership — Product Specification

Status: approved for implementation

## Ownership and roles

- There is exactly one product administrator.
- The administrator identity is configured server-side with `ADMIN_EMAIL`; it is never exposed to the browser.
- Only the administrator may activate, pause, resume, renew, change a plan, or adjust a member's quota.
- Registered users start as `pending` until the administrator activates a plan.
- Passwords are never visible to the administrator. Password changes use Supabase reset-password flows.

## Plans and prices

All prices are in Malaysian ringgit and are stored as integer sen values.

| Plan | Billing | Initial price | Renewal price | Copy allowance | Image allowance |
| --- | --- | ---: | ---: | ---: | ---: |
| Trial | One-time, 30 days | RM89 | — | 5 | 10 |
| Basic | Monthly | RM109 | RM89/month | 20 | 25 |
| Pro | Monthly | RM169 | RM109/month | 45 | 60 |

All plans may generate both content copy and sales copy. Copy types share one copy allowance.

## Usage calculation

- One successful copy-generation request deducts one copy credit, even when the response contains three copy variants.
- One successfully generated image deducts one image credit. A batch of four images deducts four credits.
- One successful image edit deducts one image credit.
- Regeneration is a new request and deducts credits again.
- Failed, timed-out, or empty OpenAI results do not consume credits. Reserved credits are refunded.
- Quota changes are atomic so concurrent requests cannot overspend the same balance.

## Period rules

- Trial is valid for 30 days from activation, does not reset, and does not renew automatically.
- Basic and Pro reset monthly on the activation-day anniversary.
- Unused credits do not roll over.
- Renewing or changing a plan starts a new allowance period and resets used credits to zero.

## Member status

- `pending`: registered but not activated.
- `active`: may use the app within the current period and quota.
- `paused`: may sign in only to see the suspension notice and contact instruction. Project and generated-content history is inaccessible.
- `expired`: the plan period ended. History remains inaccessible until reactivated.

Pausing does not extend the current billing period. If the period expires while paused, the administrator must reactivate or renew the membership.

## Administrator capabilities

The administrator may:

- search and view registered users;
- activate Trial, Basic, or Pro;
- change or renew a plan;
- pause or resume a member;
- edit member display details and internal notes;
- increase or reduce copy and image limits;
- inspect usage and failure events;
- inspect every administrator action.

## Audit requirements

All sensitive actions must leave an append-only record, including:

- successful login, failed login, logout, and password reset request;
- member activation, plan change, renewal, pause, resume, and expiry;
- member-profile changes;
- quota reservation, refund, adjustment, and monthly reset;
- copy generation, image generation, and image editing, whether successful or failed;
- the actor, subject, timestamp, reason, request metadata, and before/after values where applicable.

Audit records must not contain passwords, OpenAI API keys, Supabase service keys, or complete authentication tokens.

## Data isolation

- Membership tables live in the dedicated `consultant_marketing` schema.
- The migration must not alter, rename, delete, or reuse existing PCS tables in `public`.
- The schema migration is committed for review but must not be executed until the product owner explicitly approves it.
- After approval, `consultant_marketing` must be added to Supabase API exposed schemas so server-side PostgREST queries can address it.

## Release gates

A release may reach production only after:

1. typecheck, tests, and production build pass;
2. technical review covers authentication, authorization, RLS, atomic quota use, and audit completeness;
3. marketing review covers plan clarity, price presentation, quota wording, and upgrade/suspension messages;
4. the product owner approves the migration and production deployment;
5. Preview testing confirms login, activation, pause, resume, quota deduction/refund, and admin access on mobile Safari.
