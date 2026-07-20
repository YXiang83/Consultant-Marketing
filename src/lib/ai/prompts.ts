import type { ConsultantAnswer, GeneratedCopy, MarketingBrief, PartialBrief, RevisionKind } from "./types";

export const CONSULTANT_POLICY = `You are a professional marketing consultant helping a small business owner
who does not know marketing terminology. Ask ONE focused question at a time.
Never use jargon. Never give the user a raw prompt. Never mention that you are an AI model.
Refuse illegal, fraudulent, medical, legal, or financial-risk claims. Refuse impersonation of
real people or brands and requests that use minors inappropriately. When enough is known,
mark the flow complete.`;

export function nextQuestionPrompt(brief: PartialBrief, history: ConsultantAnswer[]) {
  return `${CONSULTANT_POLICY}

Current known brief (JSON):
${JSON.stringify(brief, null, 2)}

Answers already given:
${JSON.stringify(history, null, 2)}

Decide the single most valuable next question. Missing critical fields, in priority order:
content_type, product_or_service, goal, audience.who, audience.pain_points, platforms, tone, cta.

Return STRICT JSON matching:
{
  "step": "one of: content_type | product | goal | audience | platforms | tone | cta | done",
  "question": "the natural-language question",
  "helper": "one-sentence hint the user sees under the question",
  "input_type": "text | long_text | single_choice | multi_choice",
  "options": ["..."] (only when single_choice or multi_choice; else []),
  "is_complete": false
}

If enough info exists to produce a marketing brief, set is_complete=true and question=""
and input_type="text" and options=[].
Return ONLY the JSON object, no prose.`;
}

export function normalizeBriefPrompt(brief: PartialBrief, history: ConsultantAnswer[]) {
  return `${CONSULTANT_POLICY}

Combine the partial brief and answers into one clean MarketingBrief.
Fill missing fields with sensible defaults inferred from the answers.
Do not invent claims about real companies.

Partial brief:
${JSON.stringify(brief, null, 2)}

Answers:
${JSON.stringify(history, null, 2)}

Return STRICT JSON matching this shape (all fields present):
{
  "content_type": "...",
  "product_or_service": "...",
  "short_description": "...",
  "key_benefits": ["..."],
  "price_or_offer": "...",
  "goal": "...",
  "audience": {
    "who": "...", "region": "...", "life_stage": "...",
    "industry": "...", "needs": "...", "pain_points": "...", "objections": "..."
  },
  "platforms": ["..."],
  "tone": "...",
  "cta": "...",
  "brand_notes": "...",
  "language": "..."
}
Return ONLY the JSON.`;
}

export function copyPrompt(brief: MarketingBrief) {
  return `${CONSULTANT_POLICY}

Produce marketing copy for this brief. Keep language = ${brief.language}. Tone = ${brief.tone}.
Do not use exaggerated absolute claims (best, guaranteed, cheapest) unless the brief explicitly supports them.

Brief:
${JSON.stringify(brief, null, 2)}

Return STRICT JSON:
{
  "headline": "6-10 words, punchy",
  "hook": "one line that stops the scroll",
  "body": "80-160 words. Speaks to the audience needs and pain points. Ends with the CTA phrased naturally.",
  "short_version": "1-2 lines suitable for Stories or ads",
  "cta": "the final call to action line",
  "hashtags": ["3-8 relevant tags without the # symbol; empty array if platform does not use them"],
  "platform_variants": [
    { "platform": "one of the brief.platforms", "content": "version tailored to that platform" }
  ]
}
Return ONLY the JSON.`;
}

export function imageConceptPrompt(brief: MarketingBrief, copy: GeneratedCopy) {
  return `You are an art director for a small-business marketing consultant.
Design ONE image concept that fits the brief and copy below.
No text-in-image dependency. No real people's likenesses. No copyrighted characters.

Brief: ${JSON.stringify(brief)}
Copy headline: ${copy.headline}
Copy hook: ${copy.hook}

Return STRICT JSON:
{
  "concept": "one sentence describing the image",
  "style": "e.g. clean editorial, warm lifestyle photo, minimal vector",
  "mood": "e.g. calm, energetic, aspirational",
  "subjects": ["main subject", "supporting elements"],
  "composition": "framing/lighting notes",
  "image_prompt": "the final prompt to send to an image model, self-contained"
}
Return ONLY the JSON.`;
}

export function revisionPrompt(
  brief: MarketingBrief,
  previous: GeneratedCopy,
  kind: RevisionKind,
  instruction?: string,
) {
  const map: Record<RevisionKind, string> = {
    shorter: "Return a shorter version. Cut ~40% of the body length without losing the offer.",
    longer: "Return a longer, more descriptive version with concrete details.",
    different_tone: "Rewrite in a different tone while keeping the offer.",
    different_platform: "Adapt for a different platform's conventions.",
    different_audience: "Rewrite to speak to a different segment described below.",
    regenerate: "Regenerate a fresh version.",
  };
  return `${CONSULTANT_POLICY}

Brief:
${JSON.stringify(brief)}

Previous copy:
${JSON.stringify(previous)}

Task: ${map[kind]}${instruction ? "\nExtra instruction: " + instruction : ""}

Return STRICT JSON in the same GeneratedCopy shape. Return ONLY the JSON.`;
}

export function publishSuggestionPrompt(brief: MarketingBrief, copy: GeneratedCopy) {
  return `Give practical, region-aware publishing advice for a small business.
Brief:${JSON.stringify(brief)}
Copy headline:${copy.headline}

Return STRICT JSON:
{
  "best_times": ["..."],
  "tips": ["..."],
  "follow_up": ["..."]
}
Return ONLY the JSON.`;
}
