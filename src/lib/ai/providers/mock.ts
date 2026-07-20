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
  if (!brief.content_type && !answered.has("content_type")) return "content_type";
  if (!brief.product_or_service && !answered.has("product")) return "product";
  if (!brief.goal && !answered.has("goal")) return "goal";
  if (!brief.audience?.who && !answered.has("audience")) return "audience";
  if ((!brief.platforms || brief.platforms.length === 0) && !answered.has("platforms")) return "platforms";
  if (!brief.tone && !answered.has("tone")) return "tone";
  if (!brief.cta && !answered.has("cta")) return "cta";
  return "done";
}

const QUESTION_MAP: Record<string, NextQuestion> = {
  content_type: {
    step: "content_type",
    question: "What kind of content do you want to make today?",
    helper: "Pick the one closest to your goal — we'll adjust as we go.",
    input_type: "single_choice",
    options: ["Social post", "Ad copy", "Product promo", "Service promo", "Event promo", "Brand content", "Other"],
    is_complete: false,
  },
  product: {
    step: "product",
    question: "What product or service are you promoting?",
    helper: "One line is fine. You can add details after.",
    input_type: "text",
    options: [],
    is_complete: false,
  },
  goal: {
    step: "goal",
    question: "What outcome do you want from this content?",
    helper: "The clearer the goal, the sharper the copy.",
    input_type: "single_choice",
    options: [
      "Get more enquiries",
      "Increase sales",
      "Get bookings",
      "Promote an event",
      "Build brand awareness",
      "Educate the market",
      "Drive website traffic",
    ],
    is_complete: false,
  },
  audience: {
    step: "audience",
    question: "Who is this for?",
    helper: "Describe them in your own words — role, life stage, region, or a real customer you know.",
    input_type: "long_text",
    options: [],
    is_complete: false,
  },
  platforms: {
    step: "platforms",
    question: "Where will you publish it?",
    helper: "Pick every platform that applies.",
    input_type: "multi_choice",
    options: ["Instagram", "Facebook", "TikTok", "LinkedIn", "Xiaohongshu", "WhatsApp", "Website", "Email"],
    is_complete: false,
  },
  tone: {
    step: "tone",
    question: "How should it feel?",
    helper: "Choose the vibe your customers already trust from you.",
    input_type: "single_choice",
    options: ["Professional", "Friendly", "Premium", "Concise", "Persuasive", "Educational", "Playful", "Urgent"],
    is_complete: false,
  },
  cta: {
    step: "cta",
    question: "What action should the reader take?",
    helper: "One clear action wins.",
    input_type: "single_choice",
    options: ["Buy now", "Send a message", "Book a consultation", "Claim the offer", "Learn more", "Save", "Share"],
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
        product_or_service: knownBrief.product_or_service ?? "our product",
        short_description: knownBrief.short_description ?? "",
        key_benefits: knownBrief.key_benefits ?? [],
        price_or_offer: knownBrief.price_or_offer ?? "",
        goal: knownBrief.goal ?? "Get more enquiries",
        audience: {
          who: knownBrief.audience?.who ?? "small business owners in Malaysia",
          region: knownBrief.audience?.region ?? "Malaysia",
          life_stage: knownBrief.audience?.life_stage ?? "",
          industry: knownBrief.audience?.industry ?? "",
          needs: knownBrief.audience?.needs ?? "",
          pain_points: knownBrief.audience?.pain_points ?? "",
          objections: knownBrief.audience?.objections ?? "",
        },
        platforms: knownBrief.platforms ?? ["Instagram"],
        tone: knownBrief.tone ?? "Friendly",
        cta: knownBrief.cta ?? "Send a message",
        brand_notes: knownBrief.brand_notes ?? "",
        language: knownBrief.language ?? "en",
      });
      return { data: merged, usage: usage("mock-normalize") };
    },
    async generateMarketingCopy({ brief }) {
      const data: GeneratedCopy = {
        headline: `${brief.product_or_service}: a smarter way to ${brief.goal.toLowerCase()}`,
        hook: `If you care about ${brief.audience.who || "your customers"}, keep reading.`,
        body:
          `${brief.product_or_service} was built for ${brief.audience.who || "people like you"} who want to ${brief.goal.toLowerCase()}. ` +
          `We understand the frustration of ${brief.audience.pain_points || "wasted effort"} — and we've designed a better path. ` +
          `Here's what makes it different: it's simple, it's fast, and it works even if you have no marketing background. ` +
          `${brief.cta || "Reach out today"} to see it in action.`,
        short_version: `${brief.product_or_service} — built to ${brief.goal.toLowerCase()}. ${brief.cta || "Send a message"}.`,
        cta: brief.cta || "Send a message",
        hashtags: brief.platforms.includes("LinkedIn")
          ? []
          : ["smallbusiness", "marketing", "malaysia"].slice(0, 5),
        platform_variants: brief.platforms.map((p) => ({
          platform: p,
          content:
            p === "LinkedIn"
              ? `A quick note for ${brief.audience.who || "founders"}: ${brief.product_or_service} helps you ${brief.goal.toLowerCase()}. ${brief.cta}.`
              : `${brief.product_or_service} 🚀 — ${brief.goal}. ${brief.cta}.`,
        })),
      };
      return { data, usage: usage("mock-copy") };
    },
    async generateImageConcept({ brief, copy }) {
      const data: ImageConcept = {
        concept: `A clean lifestyle shot representing ${brief.product_or_service}`,
        style: "clean editorial photo",
        mood: brief.tone === "Premium" ? "aspirational" : "warm and approachable",
        subjects: [brief.product_or_service, brief.audience.who || "customer"],
        composition: "centered subject, soft daylight, negative space top for headline",
        image_prompt: `Editorial photo, ${brief.product_or_service}, ${brief.audience.who || "customer"}, ${brief.tone.toLowerCase()} mood, soft daylight, minimal background, negative space, headline area at top: ${copy.headline}`,
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
    async reviseGeneratedContent({ brief, previous, kind }) {
      const base = { ...previous };
      if (kind === "shorter") base.body = previous.body.split(".").slice(0, 2).join(".") + ".";
      if (kind === "longer") base.body = previous.body + " Here's another benefit worth noting: it saves hours every week.";
      if (kind === "different_tone") base.headline = `[${brief.tone}] ${previous.headline}`;
      if (kind === "regenerate") base.hook = "Fresh angle: what if this was easier than you think?";
      return { data: base, usage: usage("mock-revise") };
    },
    async generatePublishSuggestion({ brief }) {
      const data: PublishSuggestion = {
        best_times: brief.platforms.includes("LinkedIn")
          ? ["Tue 8:30am", "Thu 12:00pm"]
          : ["Wed 8:00pm", "Sat 11:00am"],
        tips: [
          "Pin the post for the first 48 hours.",
          "Reply to every comment within the first two hours.",
        ],
        follow_up: [
          "In 3 days, post a short customer testimonial.",
          "In 1 week, share a behind-the-scenes clip.",
        ],
      };
      return { data, usage: usage("mock-publish") };
    },
  };
}
