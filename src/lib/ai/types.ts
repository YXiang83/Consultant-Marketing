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

export const copyModeSchema = z.enum(["content", "sales"]);
export type CopyMode = z.infer<typeof copyModeSchema>;

export const marketingBriefSchema = z.object({
  content_type: contentTypeSchema,
  copy_mode: copyModeSchema.default("sales"),
  selected_angle: z.string().default(""),
  consultant_summary: z.string().default(""),
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
  copy_mode: copyModeSchema.optional(),
  selected_angle: z.string().optional(),
  consultant_summary: z.string().optional(),
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

export const consultantChoiceSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().default(""),
  recommended: z.boolean().default(false),
});
export type ConsultantChoice = z.infer<typeof consultantChoiceSchema>;

export const consultantTurnSchema = z.object({
  message: z.string(),
  recommendation: z.string().default(""),
  choices: z.array(consultantChoiceSchema).max(3).default([]),
  brief_patch: partialBriefSchema.default({}),
  ready_to_generate: z.boolean().default(false),
});
export type ConsultantTurn = z.infer<typeof consultantTurnSchema>;

export const platformVariantSchema = z.object({
  platform: z.string(),
  content: z.string(),
});
export type PlatformVariant = z.infer<typeof platformVariantSchema>;

export const generatedCopyVariantSchema = z.object({
  id: z.string(),
  title: z.string(),
  angle: z.string(),
  why_it_works: z.string(),
  headline: z.string(),
  hook: z.string(),
  body: z.string(),
  short_version: z.string(),
  cta: z.string(),
  hashtags: z.array(z.string()).default([]),
  platform_variants: z.array(platformVariantSchema).default([]),
});
export type GeneratedCopyVariant = z.infer<typeof generatedCopyVariantSchema>;

export const generatedCopySchema = z.object({
  copy_mode: copyModeSchema.default("sales"),
  recommended_variant_id: z.string().default("variant-1"),
  recommendation_reason: z.string().default(""),
  variants: z.array(generatedCopyVariantSchema).min(2).max(3).default([]),
  headline: z.string(),
  hook: z.string(),
  body: z.string(),
  short_version: z.string(),
  cta: z.string(),
  hashtags: z.array(z.string()).default([]),
  platform_variants: z.array(platformVariantSchema).default([]),
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

export const imageDirectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  purpose: z.string(),
  visual_description: z.string(),
  image_prompt: z.string(),
});
export type ImageDirection = z.infer<typeof imageDirectionSchema>;

export const imageDirectionSetSchema = z.object({
  directions: z.array(imageDirectionSchema).min(2).max(4),
});
export type ImageDirectionSet = z.infer<typeof imageDirectionSetSchema>;

export const generatedImageSchema = z.object({
  base64: z.string().nullable(),
  url: z.string().nullable(),
  model: z.string(),
  prompt: z.string(),
  direction_id: z.string().default(""),
  direction_title: z.string().default(""),
  parent_asset_id: z.string().optional(),
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

  continueConsultation(input: {
    knownBrief: PartialBrief;
    history: Array<{ role: "user" | "assistant"; content: string }>;
    userMessage: string;
  }): Promise<WithUsage<ConsultantTurn>>;

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

  generateImageDirections(input: {
    brief: MarketingBrief;
    copy: GeneratedCopy;
    count: 2 | 3 | 4;
  }): Promise<WithUsage<ImageDirection[]>>;

  generateMarketingImage(input: {
    prompt: string;
    aspect?: "1:1" | "4:5" | "16:9" | "9:16";
    directionId?: string;
    directionTitle?: string;
  }): Promise<WithUsage<GeneratedImage>>;

  generateMarketingImages(input: {
    directions: ImageDirection[];
    aspect?: "1:1" | "4:5" | "16:9" | "9:16";
  }): Promise<WithUsage<GeneratedImage[]>>;

  editMarketingImage(input: {
    base64: string;
    instruction: string;
    aspect?: "1:1" | "4:5" | "16:9" | "9:16";
    parentAssetId?: string;
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
