import { describe, expect, it } from "vitest";
import { mockProvider } from "@/lib/ai/providers/mock";
import { generatedCopySchema, marketingBriefSchema } from "@/lib/ai/types";

describe("mockProvider", () => {
  const provider = mockProvider();

  it("starts with the product instead of a marketing questionnaire", async () => {
    const { data } = await provider.determineNextQuestion({ knownBrief: {}, history: [] });
    expect(data.step).toBe("product");
    expect(data.is_complete).toBe(false);
    expect(data.input_type).toBe("long_text");
  });

  it("returns a consultant recommendation with simple choices", async () => {
    const { data } = await provider.continueConsultation({
      knownBrief: {},
      history: [],
      userMessage: "我在新山卖靠近 CIQ 的公寓，想找每天去新加坡工作的人。",
    });
    expect(data.message.length).toBeGreaterThan(10);
    expect(data.choices.length).toBeGreaterThanOrEqual(2);
    expect(data.choices.length).toBeLessThanOrEqual(3);
    expect(data.choices.filter((choice) => choice.recommended)).toHaveLength(1);
    expect(data.brief_patch.copy_mode).toBe("sales");
  });

  it("normalizes to a valid MarketingBrief", async () => {
    const { data } = await provider.normalizeMarketingBrief({
      knownBrief: { product_or_service: "Handmade candles", goal: "Increase sales" },
      history: [],
    });
    expect(() => marketingBriefSchema.parse(data)).not.toThrow();
    expect(["content", "sales"]).toContain(data.copy_mode);
  });

  it("generates three genuinely selectable copy variants", async () => {
    const brief = marketingBriefSchema.parse({
      content_type: "social_post",
      copy_mode: "sales",
      selected_angle: "gift buyers who need a simple present",
      consultant_summary: "Lead with the buying situation and make the next step easy.",
      product_or_service: "Handmade candles",
      short_description: "Small-batch scented candles",
      key_benefits: ["ready-to-gift packaging"],
      price_or_offer: "",
      goal: "Increase sales",
      audience: {
        who: "gift buyers",
        region: "Malaysia",
        life_stage: "",
        industry: "",
        needs: "a simple present",
        pain_points: "not knowing what to buy",
        objections: "unsure about scent",
      },
      platforms: ["Instagram", "WhatsApp"],
      tone: "Friendly",
      cta: "Send a message",
      brand_notes: "",
      language: "en",
    });
    const { data } = await provider.generateMarketingCopy({ brief });
    expect(() => generatedCopySchema.parse(data)).not.toThrow();
    expect(data.variants).toHaveLength(3);
    expect(new Set(data.variants.map((variant) => variant.id)).size).toBe(3);
    expect(data.recommended_variant_id).toBeTruthy();
  });

  it("creates four distinct image directions", async () => {
    const brief = marketingBriefSchema.parse({
      content_type: "social_post",
      copy_mode: "sales",
      product_or_service: "Handmade candles",
      goal: "Increase sales",
      audience: { who: "gift buyers" },
      platforms: ["Instagram"],
    });
    const { data: copy } = await provider.generateMarketingCopy({ brief });
    const { data: directions } = await provider.generateImageDirections({ brief, copy, count: 4 });
    expect(directions).toHaveLength(4);
    expect(new Set(directions.map((direction) => direction.id)).size).toBe(4);
  });
});
