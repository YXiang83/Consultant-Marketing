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

type Step = "content_type" | "product" | "goal" | "audience" | "platforms" | "tone" | "cta";

function firstMissingStep(brief: PartialBrief, history: ConsultantAnswer[]): Step | "done" {
  const answered = new Set(history.map((h) => h.step));
  if (!brief.product_or_service && !answered.has("product")) return "product";
  if (!brief.goal && !answered.has("goal")) return "goal";
  return "done";
}

const QUESTION_MAP: Record<string, NextQuestion> = {
  content_type: {
    step: "content_type",
    question: "先告诉我你今天想卖什么，内容形式我来决定。",
    helper: "像发 WhatsApp 一样写就行，不需要整理。",
    input_type: "long_text",
    options: [],
    is_complete: false,
  },
  product: {
    step: "product",
    question: "你今天想推广什么？随便讲，我会帮你整理。",
    helper: "产品、服务、地点、价格、照片里的内容都可以写进去。",
    input_type: "long_text",
    options: [],
    is_complete: false,
  },
  goal: {
    step: "goal",
    question: "我建议先让客户主动联系你。你更想收到询问、直接销售，还是预约？",
    helper: "不确定也没关系，我可以按最容易转化的方式处理。",
    input_type: "single_choice",
    options: ["收到更多询问", "直接销售", "增加预约", "我不确定，你帮我决定"],
    is_complete: false,
  },
  audience: {
    step: "audience",
    question: "我会根据产品判断最可能购买的人。有没有某类客户是你特别想吸引的？",
    helper: "没有的话就交给我判断。",
    input_type: "long_text",
    options: [],
    is_complete: false,
  },
  platforms: {
    step: "platforms",
    question: "你通常在哪里跟客户沟通？",
    helper: "不确定的话，我会先做适合 Facebook 和 WhatsApp 的版本。",
    input_type: "multi_choice",
    options: ["Instagram", "Facebook", "TikTok", "小红书", "WhatsApp", "我不确定"],
    is_complete: false,
  },
  tone: {
    step: "tone",
    question: "我会用自然、可信的语气。你的品牌平时更像哪一种？",
    helper: "没有固定风格就选“你帮我判断”。",
    input_type: "single_choice",
    options: ["亲切直接", "专业可信", "高端克制", "轻松活泼", "你帮我判断"],
    is_complete: false,
  },
  cta: {
    step: "cta",
    question: "客户看完后，最方便做的下一步是什么？",
    helper: "通常“发送信息”比要求客户立即购买更容易。",
    input_type: "single_choice",
    options: ["发送信息", "预约咨询", "立即购买", "点击了解", "你帮我判断"],
    is_complete: false,
  },
};

export function mockProvider(): AiProvider {
  return {
    name: "mock",
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
        tone: knownBrief.tone ?? "亲切直接",
        cta: knownBrief.cta ?? "发送信息了解详情",
        brand_notes: knownBrief.brand_notes ?? "",
        language: knownBrief.language ?? "zh",
      });
      return { data: merged, usage: usage("mock-normalize") };
    },
    async generateMarketingCopy({ brief }) {
      const audience = brief.audience.who || "正在比较选择的顾客";
      const benefit =
        brief.key_benefits[0] ||
        brief.short_description ||
        "让客户更快看懂重点，并知道下一步该怎么做";
      const offer = brief.price_or_offer ? `\n\n目前的安排：${brief.price_or_offer}。` : "";
      const data: GeneratedCopy = {
        headline: brief.product_or_service,
        hook: `${audience}通常先看两件事：适不适合自己，下一步麻不麻烦。`,
        body:
          `${brief.product_or_service}可以先把重点讲清楚：${benefit}。` +
          `${offer}\n\n不用一次决定所有事情。先把你的情况告诉我们，我们会直接说明适不适合、需要准备什么，以及接下来怎么做。\n\n${brief.cta || "发送信息了解详情"}。`,
        short_version: `${brief.product_or_service}：${benefit}。${brief.cta || "发送信息了解详情"}。`,
        cta: brief.cta || "发送信息了解详情",
        hashtags: brief.platforms.some((platform) => ["Instagram", "TikTok", "小红书"].includes(platform))
          ? ["本地服务", "实用分享"]
          : [],
        platform_variants: brief.platforms.map((platform) => ({
          platform,
          content:
            platform === "WhatsApp"
              ? `你好，我们目前在推广${brief.product_or_service}。重点是${benefit}。你可以把你的情况发给我们，我们会直接告诉你是否适合，以及下一步需要什么。`
              : platform === "小红书"
                ? `${brief.product_or_service}\n\n很多人卡住，不是因为没有选择，而是不知道哪个重点跟自己有关。这里先讲最实际的一点：${benefit}。想了解自己的情况，可以直接发信息。`
                : `${brief.product_or_service}\n\n${audience}最需要先确认的是：这是否适合自己，以及过程会不会很麻烦。${benefit}。${brief.cta || "发送信息了解详情"}。`,
        })),
      };
      return { data, usage: usage("mock-copy") };
    },
    async generateImageConcept({ brief, copy }) {
      const data: ImageConcept = {
        concept: `在真实使用场景里清楚呈现${brief.product_or_service}，画面重点只有一个。`,
        style: "自然光纪实商业摄影",
        mood: brief.tone.includes("高端") ? "克制、安静" : "真实、容易接近",
        subjects: [brief.product_or_service, brief.audience.who || "实际顾客"],
        composition: "主体占画面三分之二，保留干净留白，使用真实环境和自然光",
        image_prompt: `Realistic commercial photo of ${brief.product_or_service}, shown in a real customer setting for ${brief.audience.who || "a local customer"}. Natural daylight, specific everyday details, restrained composition, clean negative space, no text, no generic luxury styling. Visual angle based on: ${copy.hook}`,
      };
      return { data, usage: usage("mock-concept") };
    },
    async generateMarketingImage({ prompt }) {
      const data: GeneratedImage = {
        base64: null,
        url: null,
        model: "mock-image",
        prompt,
      };
      return { data, usage: { ...usage("mock-image"), image_count: 1 } };
    },
    async reviseGeneratedContent({ previous, kind }) {
      const base = { ...previous };
      if (kind === "shorter") base.body = previous.body.split("\n\n").slice(0, 2).join("\n\n");
      if (kind === "longer") {
        base.body = `${previous.body}\n\n客户联系后，先根据实际情况确认需求，再说明适合的选择和需要准备的资料。`;
      }
      if (kind === "different_tone") base.headline = previous.headline;
      if (kind === "regenerate") base.hook = "先别急着比较所有选择。把最影响决定的那一点弄清楚就够了。";
      return { data: base, usage: usage("mock-revise") };
    },
    async generatePublishSuggestion({ brief }) {
      const data: PublishSuggestion = {
        best_times: brief.platforms.includes("LinkedIn")
          ? ["星期二早上上班前测试", "星期四午休时间测试"]
          : ["星期三晚上客户较有空时测试", "星期六上午测试"],
        tips: [
          "第一张图只讲一个重点，不要把所有卖点塞进去。",
          `把 CTA 固定为“${brief.cta || "发送信息"}”，方便比较哪一版带来更多对话。`,
        ],
        follow_up: [
          "三天后发布一个真实常见问题，回答客户最担心的事情。",
          "一周后换一个角度重发，不要只改几个同义词。",
        ],
      };
      return { data, usage: usage("mock-publish") };
    },
  };
}
