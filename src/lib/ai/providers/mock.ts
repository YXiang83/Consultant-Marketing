import {
  type AiProvider,
  type ConsultantAnswer,
  type GeneratedCopy,
  type GeneratedImage,
  type ImageConcept,
  type NextQuestion,
  type PartialBrief,
  type PublishSuggestion,
  type WithUsage,
  marketingBriefSchema,
} from "@/lib/ai/types";

function usage(model: string): WithUsage<unknown>["usage"] {
  return { provider: "mock", model, input_tokens: 0, output_tokens: 0, estimated_cost: 0 };
}

function inferMode(text: string): "content" | "sales" {
  const salesSignals = ["卖", "销售", "询问", "预约", "优惠", "价格", "促销", "售完", "成交", "buy", "sale", "book", "promo"];
  return salesSignals.some((signal) => text.toLowerCase().includes(signal)) ? "sales" : "content";
}

function modeQuestion(brief: PartialBrief): NextQuestion {
  const recommended = inferMode(`${brief.product_or_service ?? ""} ${brief.short_description ?? ""}`) === "sales" ? "销售型" : "内容型";
  return {
    step: "copy_mode",
    question: "我先帮你定方向。你可以跟我的建议走，也可以换一种。",
    helper: recommended === "销售型"
      ? "你已经有明确产品或成交意图，先做销售型会更直接。"
      : "目前更适合先建立信任，让客户理解为什么要关注你。",
    input_type: "single_choice",
    options: ["内容型", "销售型"],
    recommended_option: recommended,
    recommendation_reason: recommended === "销售型"
      ? "产品和行动目标比较明确，先把客户带到询问、预约或购买。"
      : "资料还不足以硬卖，先用实用内容建立信任，效果更自然。",
    is_complete: false,
  };
}

function angleQuestion(brief: PartialBrief): NextQuestion {
  const sales = brief.copy_mode === "sales";
  const options = sales
    ? ["从客户现在的麻烦切入", "直接讲最实际的好处", "把优惠或行动理由讲清楚"]
    : ["教客户判断这类产品", "分享一个常见客户问题", "讲一个明确的行业观点"];
  return {
    step: "angle",
    question: sales ? "这次销售文案，我建议从客户最在意的问题切入。" : "这次内容，我建议先讲客户经常遇到的真实问题。",
    helper: "我已经替你缩小到三个方向，选一个就能开始生成。",
    input_type: "single_choice",
    options,
    recommended_option: options[0],
    recommendation_reason: sales
      ? "客户先认出自己的问题，才会继续看你的解决方法。"
      : "真实问题最容易让读者停下来，也比较容易建立专业感。",
    is_complete: false,
  };
}

export function mockProvider(): AiProvider {
  return {
    name: "mock",
    async determineNextQuestion({ knownBrief }) {
      if (!knownBrief.product_or_service) {
        return {
          data: {
            step: "product",
            question: "你今天想推广什么？像发 WhatsApp 一样随便讲就好。",
            helper: "产品、服务、地点、价格、客户问题，想到什么就写什么。",
            input_type: "long_text",
            options: [],
            recommended_option: "",
            recommendation_reason: "",
            is_complete: false,
          },
          usage: usage("mock-consultant"),
        };
      }
      if (!knownBrief.copy_mode) return { data: modeQuestion(knownBrief), usage: usage("mock-consultant") };
      if (!knownBrief.selected_angle) return { data: angleQuestion(knownBrief), usage: usage("mock-consultant") };
      return {
        data: {
          step: "done",
          question: "",
          helper: "",
          input_type: "text",
          options: [],
          recommended_option: "",
          recommendation_reason: "",
          is_complete: true,
        },
        usage: usage("mock-consultant"),
      };
    },

    async normalizeMarketingBrief({ knownBrief }) {
      const copyMode = knownBrief.copy_mode ?? inferMode(knownBrief.product_or_service ?? "");
      const merged = marketingBriefSchema.parse({
        content_type: copyMode === "sales" ? "ad_copy" : "social_post",
        copy_mode: copyMode,
        selected_angle: knownBrief.selected_angle ?? (copyMode === "sales" ? "从客户现在的麻烦切入" : "分享一个常见客户问题"),
        product_or_service: knownBrief.product_or_service ?? "这项产品或服务",
        short_description: knownBrief.short_description ?? knownBrief.product_or_service ?? "",
        key_benefits: knownBrief.key_benefits ?? [],
        price_or_offer: knownBrief.price_or_offer ?? "",
        goal: knownBrief.goal ?? (copyMode === "sales" ? "收到更多询问" : "建立信任"),
        audience: {
          who: knownBrief.audience?.who ?? "最可能需要这项产品或服务的本地顾客",
          region: knownBrief.audience?.region ?? "Malaysia",
          life_stage: knownBrief.audience?.life_stage ?? "",
          industry: knownBrief.audience?.industry ?? "",
          needs: knownBrief.audience?.needs ?? "快速看懂这是否适合自己",
          pain_points: knownBrief.audience?.pain_points ?? "资料太多，不知道重点",
          objections: knownBrief.audience?.objections ?? "担心不适合或过程麻烦",
        },
        platforms: knownBrief.platforms ?? ["Facebook", "WhatsApp"],
        tone: knownBrief.tone ?? "亲切直接",
        cta: knownBrief.cta ?? (copyMode === "sales" ? "发送信息了解详情" : "收藏起来，下次需要时再看"),
        brand_notes: knownBrief.brand_notes ?? "",
        language: knownBrief.language ?? "zh",
      });
      return { data: merged, usage: usage("mock-normalize") };
    },

    async generateMarketingCopy({ brief }) {
      const audience = brief.audience.who || "正在比较选择的顾客";
      const benefit = brief.key_benefits[0] || brief.short_description || "把最重要的事情讲清楚";
      const isSales = brief.copy_mode === "sales";
      const data: GeneratedCopy = isSales
        ? {
            headline: `${brief.product_or_service}，先解决这个问题`,
            hook: `${audience}通常不是没有选择，而是不知道哪一个真的适合自己。`,
            body: `${brief.selected_angle}。${brief.product_or_service}最需要讲清楚的是：${benefit}。如果你正在比较、担心流程麻烦，或不知道自己是否适合，可以先把情况发来。我们会直接说明重点，不让你绕一大圈。\n\n${brief.cta}。`,
            short_version: `${brief.product_or_service}：${benefit}。${brief.cta}。`,
            cta: brief.cta,
            hashtags: [],
            platform_variants: brief.platforms.map((platform) => ({
              platform,
              content: platform === "WhatsApp"
                ? `你好，我们目前在推广${brief.product_or_service}。重点是${benefit}。你可以把情况发来，我们会直接告诉你是否适合。`
                : `${brief.product_or_service}\n\n${audience}最关心的是适不适合、过程麻不麻烦。${benefit}。${brief.cta}。`,
            })),
          }
        : {
            headline: `很多人误会了${brief.product_or_service}`,
            hook: `${audience}最常卡住的，不是没有资料，而是不知道该看哪一点。`,
            body: `${brief.selected_angle}。先看最实际的一点：${benefit}。判断这类产品或服务，不需要一次理解所有细节。先确认它解决什么问题、适合谁，以及什么情况下不适合。把这三件事弄清楚，决定会简单很多。\n\n${brief.cta}。`,
            short_version: `判断${brief.product_or_service}，先别看全部资料。先看它解决什么问题。`,
            cta: brief.cta,
            hashtags: ["实用分享", "本地生意"],
            platform_variants: brief.platforms.map((platform) => ({
              platform,
              content: platform === "WhatsApp"
                ? `很多人问${brief.product_or_service}该怎么看。最简单的方法，是先确认它解决什么问题、适合谁。`
                : `很多人误会了${brief.product_or_service}。真正要先看的，是它解决什么问题，而不是资料有多少。`,
            })),
          };
      return { data, usage: usage("mock-copy") };
    },

    async generateImageConcept({ brief, copy }) {
      const data: ImageConcept = {
        concept: `用一个真实使用场景呈现“${brief.selected_angle}”，画面只保留一个重点。`,
        style: "自然光纪实商业摄影",
        mood: brief.copy_mode === "sales" ? "直接、可信" : "真实、有观察感",
        subjects: [brief.product_or_service, brief.audience.who || "实际顾客"],
        composition: "主体占画面三分之二，真实环境，自然光，保留干净留白",
        image_prompt: `Realistic commercial photo of ${brief.product_or_service} in a real customer setting. Visual angle: ${brief.selected_angle}. Natural daylight, specific everyday details, restrained composition, clean negative space, no text. Context from copy: ${copy.hook}`,
      };
      return { data, usage: usage("mock-concept") };
    },

    async generateMarketingImage({ prompt }) {
      return {
        data: { base64: null, url: null, model: "mock-image", prompt },
        usage: { ...usage("mock-image"), image_count: 1 },
      };
    },

    async reviseGeneratedContent({ previous, kind }) {
      const base = { ...previous };
      if (kind === "shorter") base.body = previous.body.split("\n\n")[0];
      if (kind === "longer") base.body = `${previous.body}\n\n再补一个真实常见问题，让客户更容易判断自己是否适合。`;
      if (kind === "regenerate") base.hook = "先把最影响决定的那一点弄清楚，其他资料才有意义。";
      return { data: base, usage: usage("mock-revise") };
    },

    async generatePublishSuggestion({ brief }) {
      const data: PublishSuggestion = {
        best_times: ["星期三晚上测试", "星期六上午测试"],
        tips: brief.copy_mode === "sales"
          ? ["第一张图只讲一个客户问题。", `CTA 固定为“${brief.cta}”，方便比较询问量。`]
          : ["开头先讲一个客户常见误区。", "结尾不要硬卖，给一个容易接受的下一步。"],
        follow_up: ["三天后换第二个角度继续讲。", "一周后用真实常见问题做跟进。"],
      };
      return { data, usage: usage("mock-publish") };
    },
  };
}
