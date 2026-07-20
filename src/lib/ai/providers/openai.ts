import OpenAI from "openai";
import { serverEnv } from "@/lib/env";
import {
  type AiProvider,
  type GeneratedCopy,
  type GeneratedImage,
  type ImageConcept,
  type MarketingBrief,
  type NextQuestion,
  type PublishSuggestion,
  type WithUsage,
  generatedCopySchema,
  imageConceptSchema,
  marketingBriefSchema,
  nextQuestionSchema,
  publishSuggestionSchema,
} from "@/lib/ai/types";
import {
  copyPrompt,
  imageConceptPrompt,
  nextQuestionPrompt,
  normalizeBriefPrompt,
  publishSuggestionPrompt,
  revisionPrompt,
} from "@/lib/ai/prompts";
import type { z } from "zod";

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

async function jsonCompletion<T>(schema: z.ZodType<T>, prompt: string): Promise<WithUsage<T>> {
  const c = client();
  const model = textModel();
  const res = await c.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });
  const content = res.choices[0]?.message?.content ?? "{}";
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new Error("AI returned invalid JSON");
  }
  const parsed = schema.safeParse(parsedJson);
  if (!parsed.success) {
    // One controlled retry with a stricter reminder.
    const retry = await c.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "user", content: prompt },
        { role: "user", content: "Your previous response did not match the JSON schema. Return ONLY the JSON object matching the exact fields required." },
      ],
      temperature: 0.3,
    });
    const retryContent = retry.choices[0]?.message?.content ?? "{}";
    const retryJson = (() => { try { return JSON.parse(retryContent); } catch { return {}; } })();
    const retryParsed = schema.safeParse(retryJson);
    if (!retryParsed.success) throw new Error("AI output failed schema validation");
    return {
      data: retryParsed.data,
      usage: {
        provider: "openai",
        model,
        input_tokens: (res.usage?.prompt_tokens ?? 0) + (retry.usage?.prompt_tokens ?? 0),
        output_tokens: (res.usage?.completion_tokens ?? 0) + (retry.usage?.completion_tokens ?? 0),
        request_id: retry.id,
      },
    };
  }
  return {
    data: parsed.data,
    usage: {
      provider: "openai",
      model,
      input_tokens: res.usage?.prompt_tokens,
      output_tokens: res.usage?.completion_tokens,
      request_id: res.id,
    },
  };
}

export function openAiProvider(): AiProvider {
  return {
    name: "openai",
    async determineNextQuestion({ knownBrief, history }) {
      return jsonCompletion<NextQuestion>(nextQuestionSchema, nextQuestionPrompt(knownBrief, history));
    },
    async normalizeMarketingBrief({ knownBrief, history }) {
      return jsonCompletion<MarketingBrief>(marketingBriefSchema, normalizeBriefPrompt(knownBrief, history));
    },
    async generateMarketingCopy({ brief }) {
      return jsonCompletion<GeneratedCopy>(generatedCopySchema, copyPrompt(brief));
    },
    async generateImageConcept({ brief, copy }) {
      return jsonCompletion<ImageConcept>(imageConceptSchema, imageConceptPrompt(brief, copy));
    },
    async generateMarketingImage({ prompt, aspect }) {
      const c = client();
      const model = imageModel();
      const size =
        aspect === "9:16" ? "1024x1792" : aspect === "16:9" ? "1792x1024" : aspect === "4:5" ? "1024x1280" : "1024x1024";
      const res = await c.images.generate({ model, prompt, size, n: 1 });
      const first = res.data?.[0];
      const data: GeneratedImage = {
        base64: first?.b64_json ?? null,
        url: first?.url ?? null,
        model,
        prompt,
      };
      return {
        data,
        usage: { provider: "openai", model, image_count: 1 },
      };
    },
    async reviseGeneratedContent({ brief, previous, kind, instruction }) {
      return jsonCompletion<GeneratedCopy>(generatedCopySchema, revisionPrompt(brief, previous, kind, instruction));
    },
    async generatePublishSuggestion({ brief, copy }) {
      return jsonCompletion<PublishSuggestion>(publishSuggestionSchema, publishSuggestionPrompt(brief, copy));
    },
  };
}
