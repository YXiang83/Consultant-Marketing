import {
  type AiProvider,
  type ConsultantAnswer,
  type ConsultantTurn,
  type GeneratedCopy,
  type GeneratedCopyVariant,
  type GeneratedImage,
  type ImageConcept,
  type ImageDirection,
  type NextQuestion,
  type PartialBrief,
  type PublishSuggestion,
  type WithUsage,
  marketingBriefSchema,
} from "@/lib/ai/types";

function usage(model: string): WithUsage<unknown>["usage"] {
  return { provider: "mock", model, input_tokens: 0, output_tokens: 0, estimated_cost: 0 };
}

type Step = "product" | "goal";

function firstMissingStep(brief: PartialBrief, history: ConsultantAnswer[]): Step | "done" {
  const answered = new Set(history.map((h) => h.step));
  if (!brief.product_or_service && !answered.has("product")) return "product";
  if (!brief.goal && !answered.has("goal")) return "goal";
  return "done";
}

const QUESTION_MAP: Record<Step, NextQuestion> = {
  product: {
    step: "product",
    question: "你今天想推广什么？随便讲，我会帮你整理。",
    helper: "产品、服务、地点、价格或现有资料都可以写进去。",
    input_type: "long_text",
    options: [],
    is_complete: false,
  },
  goal: {
    step: "goal",
    question: "我建议先让客户主动联系你。你想要询问、预约，还是直接销售？",
    helper: "不确定的话，我会按最容易开始的方式处理。",
    input_type: "single_choice",
    options: ["收到询问", "增加预约", "直接销售"],
    is_complete: false,
  },
};

function makeVariant(input: {
  id: string;
  title: string;
  angle: string;
  product: string;
  benefit: string;
  cta: string;
  platforms: string[];
}): GeneratedCopyVariant {
  const body = `${input.angle}。${input.product}把重点放在${input.benefit}。先了解实际情况，再决定是否适合，不需要一开始就做复杂选择。\n\n${input.cta}。`;
  return {
    id: input.id,
    title: input.title,
    angle: input.angle,
    why_it_works: "先让顾客看见跟自己有关的重点，再给一个容易采取的下一步。",
    headline: input.title,
    hook: input.angle,
    body,
    short_version: `${input.product}：${input.benefit}。${input.cta}。`,
    cta: input.cta,
    hashtags: [],
    platform_variants: input.platforms.map((platform) => ({ platform, content: body })),
  };
}

export function mockProvider(): AiProvider {
  return {
    name: "mock",

    async continueConsultation({ knownBrief, userMessage }) {
      const hasProduct = Boolean(knownBrief.product_or_service || userMessage.trim());
      const data: ConsultantTurn = {
        message: hasProduct
          ? "我先替你判断：如果现在有明确产品和希望客户采取的行动，销售型会更直接；如果还没有优惠或明确行动，内容型更适合先建立信任。"
          : "先告诉我你今天想推广什么。像发 WhatsApp 一样写，不需要整理。",
        recommendation: hasProduct ? "先做销售型，因为更容易验证有没有客户主动联系。" : "",
        choices: hasProduct
          ? [
              { id: "content", label: "内容型", description: "先教育、分享观点或建立信任", recommended: false },
              { id: "sales", label: "销售型", description: "推动询问、预约或购买", recommended: true },
            ]
          : [],
        brief_patch: {
          product_or_service: knownBrief.product_or_service ?? userMessage.trim(),
          copy_mode: "sales",
          selected_angle: "从顾客当前最实际的问题切入",
          goal: knownBrief.goal ?? "收到更多询问",
          platforms: knownBrief.platforms ?? ["Facebook", "WhatsApp"],
          tone: knownBrief.tone ?? "自然、可信",
          cta: knownBrief.cta ?? "发送信息了解详情",
          language: knownBrief.language ?? "zh",
        },
        ready_to_generate: hasProduct,
      };
      return { data, usage: usage("mock-consultant") };
    },

    async determineNextQuestion({ knownBrief, history }) {
      const step = firstMissingStep(knownBrief, history);
      if (step === "done") {
        return {
          data: { step: "done", question: "", helper: "", input_type: "text", options: [], is_complete: true },
          usage: usage("mock-consultant"),
        };
      }
      return { data: QUESTION_MAP[step], usage: usage("mock-consultant") };
    },

    async normalizeMarketingBrief({ knownBrief }) {
      const merged = marketingBriefSchema.parse({
        content_type: knownBrief.content_type ?? "social_post",
        copy_mode: knownBrief.copy_mode ?? "sales",
        selected_angle: knownBrief.selected_angle ?? "从顾客当前最实际的问题切入",
        consultant_summary: knownBrief.consultant_summary ?? "先用一个清楚的顾客问题测试询问反应。",
        product_or_service: knownBrief.product_or_service ?? "这项产品或服务",
        short_description: knownBrief.short_description ?? "",
        key_benefits: knownBrief.key_benefits ?? [],
        price_or_offer: knownBrief.price_or_offer ?? "",
        goal: knownBrief.goal ?? "收到更多询问",
        audience: {
          who: knownBrief.audience?.who ?? "最可能需要这项产品或服务的本地顾客",
          region: knownBrief.audience?.region ?? "Malaysia",
          life_stage: knownBrief.audience?.life_stage ?? "",
          industry: knownBrief.audience?.industry ?? "",
          needs: knownBrief.audience?.needs ?? "想快速判断是否适合自己",
          pain_points: knownBrief.audience?.pain_points ?? "资料太多，不知道重点在哪里",
          objections: knownBrief.audience?.objections ?? "担心不适合或过程麻烦",
        },
        platforms: knownBrief.platforms ?? ["Facebook", "WhatsApp"],
        tone: knownBrief.tone ?? "自然、可信",
        cta: knownBrief.cta ?? "发送信息了解详情",
        brand_notes: knownBrief.brand_notes ?? "",
        language: knownBrief.language ?? "zh",
      });
      return { data: merged, usage: usage("mock-normalize") };
    },

    async generateMarketingCopy({ brief }) {
      const product = brief.product_or_service;
      const benefit = brief.key_benefits[0] || brief.short_description || "让顾客更快看懂重点";
      const cta = brief.cta || "发送信息了解详情";
      const variants = [
        makeVariant({ id: "variant-1", title: "先讲顾客的问题", angle: "很多人不是没有选择，而是不知道哪一个重点跟自己有关", product, benefit, cta, platforms: brief.platforms }),
        makeVariant({ id: "variant-2", title: "直接讲实际好处", angle: `先把最实际的好处讲清楚：${benefit}`, product, benefit, cta, platforms: brief.platforms }),
        makeVariant({ id: "variant-3", title: "降低行动门槛", angle: "不用马上决定，先把情况说明清楚", product, benefit, cta, platforms: brief.platforms }),
      ];
      const recommended = variants[0];
      const data: GeneratedCopy = {
        copy_mode: brief.copy_mode,
        recommended_variant_id: recommended.id,
        recommendation_reason: "顾客先认出自己的问题，通常更愿意继续看解决方式。",
        variants,
        headline: recommended.headline,
        hook: recommended.hook,
        body: recommended.body,
        short_version: recommended.short_version,
        cta: recommended.cta,
        hashtags: recommended.hashtags,
        platform_variants: recommended.platform_variants,
      };
      return { data, usage: usage("mock-copy") };
    },

    async generateImageConcept({ brief, copy }) {
      const data: ImageConcept = {
        concept: `在真实使用场景里呈现${brief.product_or_service}。`,
        style: "自然光纪实商业摄影",
        mood: "真实、可信",
        subjects: [brief.product_or_service, brief.audience.who || "实际顾客"],
        composition: "主体清楚，保留干净留白供后续叠加标题和 CTA",
        image_prompt: `Realistic commercial photo of ${brief.product_or_service}. Natural daylight, authentic local setting, clean negative space, no text. Visual angle: ${copy.hook}`,
      };
      return { data, usage: usage("mock-concept") };
    },

    async generateImageDirections({ brief, copy, count }) {
      const base: ImageDirection[] = [
        { id: "product", title: "产品主体", purpose: "让顾客马上看懂卖什么", visual_description: "清楚呈现产品或服务主体", image_prompt: `Product-focused commercial image of ${brief.product_or_service}, authentic details, natural light, clean negative space, no text.` },
        { id: "customer", title: "顾客场景", purpose: "让目标顾客代入", visual_description: "目标顾客在真实情境中使用或考虑产品", image_prompt: `Realistic customer situation for ${brief.product_or_service}, audience ${brief.audience.who}, natural local setting, no text.` },
        { id: "problem", title: "问题场景", purpose: "让顾客认出自己的困扰", visual_description: copy.hook, image_prompt: `Advertising scene visualizing this customer problem: ${copy.hook}. Realistic, restrained, no text.` },
        { id: "layout", title: "广告留白", purpose: "方便后续叠加标题与 CTA", visual_description: "主体偏一侧，另一侧保留干净空间", image_prompt: `Campaign-ready image for ${brief.product_or_service}, subject placed to one side, generous clean negative space, realistic, no text.` },
      ];
      return { data: base.slice(0, count), usage: usage("mock-directions") };
    },

    async generateMarketingImage({ prompt, directionId, directionTitle }) {
      const data: GeneratedImage = {
        base64: null,
        url: null,
        model: "mock-image",
        prompt,
        direction_id: directionId ?? "",
        direction_title: directionTitle ?? "",
      };
      return { data, usage: { ...usage("mock-image"), image_count: 1 } };
    },

    async generateMarketingImages({ directions }) {
      return {
        data: directions.map((direction) => ({
          base64: null,
          url: null,
          model: "mock-image",
          prompt: direction.image_prompt,
          direction_id: direction.id,
          direction_title: direction.title,
        })),
        usage: { ...usage("mock-image"), image_count: directions.length },
      };
    },

    async editMarketingImage({ instruction, parentAssetId }) {
      return {
        data: {
          base64: null,
          url: null,
          model: "mock-image-edit",
          prompt: instruction,
          direction_id: "edited",
          direction_title: "Customer edit",
          parent_asset_id: parentAssetId,
        },
        usage: { ...usage("mock-image-edit"), image_count: 1 },
      };
    },

    async reviseGeneratedContent({ previous, kind, instruction }) {
      const suffix = instruction ? `\n\n修改要求：${instruction}` : "";
      const variants = previous.variants.map((variant) => ({
        ...variant,
        body: kind === "shorter" ? variant.body.split("\n\n")[0] : `${variant.body}${suffix}`,
      }));
      const recommended = variants.find((variant) => variant.id === previous.recommended_variant_id) ?? variants[0];
      return {
        data: {
          ...previous,
          variants,
          headline: recommended.headline,
          hook: recommended.hook,
          body: recommended.body,
          short_version: recommended.short_version,
          cta: recommended.cta,
          hashtags: recommended.hashtags,
          platform_variants: recommended.platform_variants,
        },
        usage: usage("mock-revise"),
      };
    },

    async generatePublishSuggestion({ brief }) {
      const data: PublishSuggestion = {
        best_times: brief.platforms.includes("LinkedIn")
          ? ["星期二早上测试", "星期四午休时间测试"]
          : ["星期三晚上测试", "星期六上午测试"],
        tips: ["第一张图只讲一个重点。", `把 CTA 固定为“${brief.cta || "发送信息"}”来比较实际反应。`],
        follow_up: ["三天后回答一个真实常见问题。", "一周后换一个策略角度重发。"],
      };
      return { data, usage: usage("mock-publish") };
    },
  };
}
