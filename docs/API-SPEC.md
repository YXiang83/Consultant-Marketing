# API

All routes require an authenticated Supabase session cookie unless noted.
Bodies are JSON. Errors return plain-text status or a JSON `{ error }`.

## `GET /api/health`
Public. Returns `{ ok: true }`.

## `POST /api/consultant/next-question`
Body: `{ sessionId: uuid, brief?: PartialBrief }`
Returns `{ question: NextQuestion, brief: PartialBrief }`. `question.is_complete=true`
means the client should route to the brief-confirmation page.

## `POST /api/consultant/answer`
Body: `{ sessionId: uuid, step: string, answer: string | string[] }`
Persists an answer and merges it into `structured_brief`. Returns `{ brief }`.

## `POST /api/consultant/normalize`
Body: `{ sessionId: uuid }`
Runs `normalizeMarketingBrief`, persists it on the session and project, returns
`{ brief: MarketingBrief }`.

## `POST /api/generate/copy`
Body: `{ projectId: uuid, brief: MarketingBrief }`
Reserves 1 copy credit, generates, persists `generated_assets`, records
`usage_events`. `402` when over limit or no subscription.

## `POST /api/generate/image`
Body: `{ projectId: uuid }`
Reads latest copy + brief for the project, generates a concept + image, saves
both as `generated_assets`. Reserves 1 image credit.

## `POST /api/generate/revise`
Body: `{ projectId: uuid, kind: RevisionKind, instruction?: string }`
Generates a revised copy version and inserts a new `generated_assets` row with
`version = previous.version + 1`.

## `POST /auth/logout`
Clears Supabase cookies, redirects to `/`.

## `GET /auth/callback?code=…&next=…`
Supabase OAuth / magic-link exchange.
