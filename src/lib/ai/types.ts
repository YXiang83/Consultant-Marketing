import { z } from "zod";

export const contentTypeSchema = z.enum([
  "social_post",
  "ad_copy",
  "product_promo",
  "service_promo",
  "event_promo",
  "brand_content",
  "other",
]);
export type ContentType = z.infer<typeof contentTypeSchema>;

export const marketingBriefSchema = z.object({
  content_type: contentTypeSchema,
  product_or_service: z.string().min(1),
  short_description: z.string().default(""),
  key_benefits: z.array(z.string()).default([]),
  price_or_offer: z.string().default(""),
  goal: z.string().min(1),
  audience: z.object({
    who: z.string().default(""),
    region: z.string().default(""),
    life_stage: z.string().default(""),
    industry: z.string().default(""),
    needs: z.string().default(""),
    pain_points: z.string().default(""),
    objections: z.string().default(""),
  }),
  platforms: z.array(z.string()).default([]),
  tone: z.string().default("friendly"),
  cta: z.string().default(""),
  brand_notes: z.string().default(""),
  language: z.string().default("en"),
});
export type MarketingBrief = z.infer<typeof marketingBriefSchema>;

export const partialBriefSchema = z.object({
  content_type: contentTypeSchema.optional(),
  product_or_service: z.string().optional(),
  short_description: z.string().optional(),
  key_benefits: z.array(z.string()).optional(),
  price_or_offer: z.string().optional(),
  goal: z.string().optional(),
  audience: z
    .object({
      who: z.string().optional(),
      region: z.string().optional(),
      life_stage: z.string().optional(),
      industry: z.string().optional(),
      needs: z.string().optional(),
      pain_points: z.string().optional(),
      objections: z.string().optional(),
    })
    .optional(),
  platforms: z.array(z.string()).optional(),
  tone: z.string().optional(),
  cta: z.string().optional(),
  brand_notes: z.string().optional(),
  language: z.string().optional(),
});
export type PartialBrief = z.infer<typeof partialBriefSchema>;

export const consultantAnswerSchema = z.object({
  step: z.string(),
  answer: z.union([z.string(), z.array(z.string())]),
});
export type ConsultantAnswer = z.infer<typeof consultantAnswerSchema>;

export const nextQuestionSchema = z.object({
  step: z.string(),
  question: z.string(),
  helper: z.string().default(""),
  input_type: z.enum(["text", "long_text", "single_choice", "multi_choice"]),
  options: z.array(z.string()).default([]),
  is_complete: z.boolean().default(false),
});
export type NextQuestion = z.infer<typeof nextQuestionSchema>;

export const generatedCopySchema = z.object({
  headline: z.string(),
  hook: z.string(),
  body: z.string(),
  short_version: z.string(),
  cta: z.string(),
  hashtags: z.array(z.string()).default([]),
  platform_variants: z
    .array(
      z.object({
        platform: z.string(),
        content: z.string(),
      }),
    )
    .default([]),
});
export type GeneratedCopy = z.infer<typeof generatedCopySchema>;

export const imageConceptSchema = z.object({
  concept: z.string(),
  style: z.string(),
  mood: z.string(),
  subjects: z.array(z.string()).default([]),
  composition: z.string().default(""),
  image_prompt: z.string(),
});
export type ImageConcept = z.infer<typeof imageConceptSchema>;

export const generatedImageSchema = z.object({
  base64: z.string().nullable(),
  url: z.string().nullable(),
  model: z.string(),
  prompt: z.string(),
});
export type GeneratedImage = z.infer<typeof generatedImageSchema>;

export const publishSuggestionSchema = z.object({
  best_times: z.array(z.string()).default([]),
  tips: z.array(z.string()).default([]),
  follow_up: z.array(z.string()).default([]),
});
export type PublishSuggestion = z.infer<typeof publishSuggestionSchema>;

export type UsageMeta = {
  provider: string;
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  image_count?: number;
  estimated_cost?: number;
  request_id?: string;
};

export type WithUsage<T> = { data: T; usage: UsageMeta };

export type RevisionKind =
  | "shorter"
  | "longer"
  | "different_tone"
  | "different_platform"
  | "different_audience"
  | "regenerate";

export interface AiProvider {
  name: string;
  determineNextQuestion(input: {
    knownBrief: PartialBrief;
    history: ConsultantAnswer[];
  }): Promise<WithUsage<NextQuestion>>;

  normalizeMarketingBrief(input: {
    knownBrief: PartialBrief;
    history: ConsultantAnswer[];
  }): Promise<WithUsage<MarketingBrief>>;

  generateMarketingCopy(input: { brief: MarketingBrief }): Promise<WithUsage<GeneratedCopy>>;

  generateImageConcept(input: {
    brief: MarketingBrief;
    copy: GeneratedCopy;
  }): Promise<WithUsage<ImageConcept>>;

  generateMarketingImage(input: {
    prompt: string;
    aspect?: "1:1" | "4:5" | "16:9" | "9:16";
  }): Promise<WithUsage<GeneratedImage>>;

  reviseGeneratedContent(input: {
    brief: MarketingBrief;
    previous: GeneratedCopy;
    kind: RevisionKind;
    instruction?: string;
  }): Promise<WithUsage<GeneratedCopy>>;

  generatePublishSuggestion(input: {
    brief: MarketingBrief;
    copy: GeneratedCopy;
  }): Promise<WithUsage<PublishSuggestion>>;
}
