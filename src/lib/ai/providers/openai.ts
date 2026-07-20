import OpenAI, { toFile } from "openai";
import type { z } from "zod";
import { serverEnv } from "@/lib/env";
import {
  type AiProvider,
  type ConsultantTurn,
  type GeneratedCopy,
  type GeneratedImage,
  type ImageConcept,
  type ImageDirection,
  type MarketingBrief,
  type NextQuestion,
  type PublishSuggestion,
  type WithUsage,
  consultantTurnSchema,
  generatedCopySchema,
  imageConceptSchema,
  imageDirectionSetSchema,
  marketingBriefSchema,
  nextQuestionSchema,
  publishSuggestionSchema,
} from "@/lib/ai/types";
import {
  consultantTurnPrompt,
  copyPrompt,
  imageConceptPrompt,
  imageDirectionsPrompt,
  nextQuestionPrompt,
  normalizeBriefPrompt,
  publishSuggestionPrompt,
  revisionPrompt,
} from "@/lib/ai/prompts";

function client() {
  const env = serverEnv();
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for OpenAI provider");
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

function textModel() {
  return serverEnv().OPENAI_TEXT_MODEL;
}

function imageModel() {
  return serverEnv().OPENAI_IMAGE_MODEL;
}

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  return JSON.parse(withoutFence || "{}");
}

async function jsonResponse<T>(schema: z.ZodType<T>, prompt: string): Promise<WithUsage<T>> {
  const c = client();
  const model = textModel();
  const first = await c.responses.create({
    model,
    input: prompt,
    store: false,
    max_output_tokens: 7000,
  });

  let firstJson: unknown = {};
  try {
    firstJson = parseJson(first.output_text);
  } catch {
    firstJson = {};
  }
  const parsed = schema.safeParse(firstJson);

  if (parsed.success) {
    return {
      data: parsed.data,
      usage: {
        provider: "openai",
        model,
        input_tokens: first.usage?.input_tokens,
        output_tokens: first.usage?.output_tokens,
        request_id: first.id,
      },
    };
  }

  const retry = await c.responses.create({
    model,
    input: `${prompt}\n\nYour previous output failed schema validation. Return only the exact JSON object requested. Do not use markdown fences or add commentary.`,
    store: false,
    max_output_tokens: 7000,
  });

  let retryJson: unknown = {};
  try {
    retryJson = parseJson(retry.output_text);
  } catch {
    retryJson = {};
  }
  const retryParsed = schema.safeParse(retryJson);
  if (!retryParsed.success) {
    throw new Error(`AI output failed schema validation: ${retryParsed.error.message}`);
  }

  return {
    data: retryParsed.data,
    usage: {
      provider: "openai",
      model,
      input_tokens: (first.usage?.input_tokens ?? 0) + (retry.usage?.input_tokens ?? 0),
      output_tokens: (first.usage?.output_tokens ?? 0) + (retry.usage?.output_tokens ?? 0),
      request_id: retry.id,
    },
  };
}

function imageSize(
  aspect: "1:1" | "4:5" | "16:9" | "9:16" = "1:1",
): "1024x1024" | "1024x1536" | "1536x1024" {
  if (aspect === "16:9") return "1536x1024";
  if (aspect === "4:5" || aspect === "9:16") return "1024x1536";
  return "1024x1024";
}

async function generateOneImage(input: {
  prompt: string;
  aspect?: "1:1" | "4:5" | "16:9" | "9:16";
  directionId?: string;
  directionTitle?: string;
}): Promise<WithUsage<GeneratedImage>> {
  const c = client();
  const model = imageModel();
  const res = await c.images.generate({
    model,
    prompt: input.prompt,
    size: imageSize(input.aspect),
    quality: "medium",
    n: 1,
  });
  const first = res.data?.[0];
  return {
    data: {
      base64: first?.b64_json ?? null,
      url: first?.url ?? null,
      model,
      prompt: input.prompt,
      direction_id: input.directionId ?? "",
      direction_title: input.directionTitle ?? "",
    },
    usage: { provider: "openai", model, image_count: 1 },
  };
}

export function openAiProvider(): AiProvider {
  return {
    name: "openai",

    async continueConsultation({ knownBrief, history, userMessage }) {
      return jsonResponse<ConsultantTurn>(
        consultantTurnSchema,
        consultantTurnPrompt({ brief: knownBrief, history, userMessage }),
      );
    },

    async determineNextQuestion({ knownBrief, history }) {
      return jsonResponse<NextQuestion>(nextQuestionSchema, nextQuestionPrompt(knownBrief, history));
    },

    async normalizeMarketingBrief({ knownBrief, history }) {
      return jsonResponse<MarketingBrief>(marketingBriefSchema, normalizeBriefPrompt(knownBrief, history));
    },

    async generateMarketingCopy({ brief }) {
      return jsonResponse<GeneratedCopy>(generatedCopySchema, copyPrompt(brief));
    },

    async generateImageConcept({ brief, copy }) {
      return jsonResponse<ImageConcept>(imageConceptSchema, imageConceptPrompt(brief, copy));
    },

    async generateImageDirections({ brief, copy, count }) {
      const result = await jsonResponse(
        imageDirectionSetSchema,
        imageDirectionsPrompt(brief, copy, count),
      );
      return { data: result.data.directions, usage: result.usage };
    },

    async generateMarketingImage({ prompt, aspect, directionId, directionTitle }) {
      return generateOneImage({ prompt, aspect, directionId, directionTitle });
    },

    async generateMarketingImages({ directions, aspect }) {
      const generated = await Promise.all(
        directions.map((direction) =>
          generateOneImage({
            prompt: direction.image_prompt,
            aspect,
            directionId: direction.id,
            directionTitle: direction.title,
          }),
        ),
      );
      return {
        data: generated.map((item) => item.data),
        usage: {
          provider: "openai",
          model: imageModel(),
          image_count: generated.length,
        },
      };
    },

    async editMarketingImage({ base64, instruction, aspect, parentAssetId }) {
      const c = client();
      const model = imageModel();
      const image = await toFile(Buffer.from(base64, "base64"), "selected-image.png", {
        type: "image/png",
      });
      const res = await c.images.edit({
        model,
        image,
        prompt: `Edit the supplied marketing image according to this customer instruction: ${instruction}. Preserve everything the customer did not ask to change. Do not add rendered headline, price, logo, or CTA text unless the customer explicitly asks for text.`,
        size: imageSize(aspect),
        quality: "medium",
        n: 1,
      });
      const first = res.data?.[0];
      return {
        data: {
          base64: first?.b64_json ?? null,
          url: first?.url ?? null,
          model,
          prompt: instruction,
          direction_id: "edited",
          direction_title: "Customer edit",
          parent_asset_id: parentAssetId,
        },
        usage: { provider: "openai", model, image_count: 1 },
      };
    },

    async reviseGeneratedContent({ brief, previous, kind, instruction }) {
      return jsonResponse<GeneratedCopy>(
        generatedCopySchema,
        revisionPrompt(brief, previous, kind, instruction),
      );
    },

    async generatePublishSuggestion({ brief, copy }) {
      return jsonResponse<PublishSuggestion>(
        publishSuggestionSchema,
        publishSuggestionPrompt(brief, copy),
      );
    },
  };
}
