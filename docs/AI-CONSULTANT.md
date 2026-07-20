# AI Consultant Flow

## Steps
1. `content_type` — one of `social_post`, `ad_copy`, `product_promo`, `service_promo`, `event_promo`, `brand_content`, `other`
2. `product` — product or service name + one-line description
3. `goal` — one of Get enquiries / Increase sales / Book / Event / Brand awareness / Educate / Traffic
4. `audience` — who, region, life stage, industry, needs, pain points, objections
5. `platforms` — multi-choice
6. `tone` — single choice
7. `cta` — single choice
8. `done` — normalize + confirm brief → generate

## Prompt architecture
Each concern is a separate prompt (`src/lib/ai/prompts.ts`):

- `CONSULTANT_POLICY` — global safety and voice rules, injected into every prompt
- `nextQuestionPrompt` — picks the single most valuable next question
- `normalizeBriefPrompt` — fills a full `MarketingBrief` from partial + history
- `copyPrompt` — produces `GeneratedCopy` (headline/hook/body/short/CTA/hashtags/platform variants)
- `imageConceptPrompt` — art-direction JSON, ending in an `image_prompt` for the image model
- `revisionPrompt` — targeted transformations (shorter/longer/tone/…)
- `publishSuggestionPrompt` — best times, tips, follow-up

## Output validation
All JSON responses are Zod-parsed. On failure the OpenAI provider does exactly
one controlled retry with a stricter instruction, then surfaces an error.

## Mock provider
`mockProvider` (`src/lib/ai/providers/mock.ts`) implements the same interface
deterministically. It exists so the entire UI flow — auth, quota, generation,
revision — is testable without any API key.
