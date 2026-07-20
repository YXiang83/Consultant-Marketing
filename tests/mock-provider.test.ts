import { describe, expect, it } from "vitest";
import { mockProvider } from "@/lib/ai/providers/mock";
import { marketingBriefSchema, generatedCopySchema } from "@/lib/ai/types";

describe("mockProvider", () => {
  const provider = mockProvider();

  it("asks content_type first for an empty brief", async () => {
    const { data } = await provider.determineNextQuestion({ knownBrief: {}, history: [] });
    expect(data.step).toBe("content_type");
    expect(data.is_complete).toBe(false);
    expect(data.options.length).toBeGreaterThan(0);
  });

  it("marks complete once all required fields are known", async () => {
    const { data } = await provider.determineNextQuestion({
      knownBrief: {
        content_type: "social_post",
        product_or_service: "Handmade candles",
        goal: "Increase sales",
        audience: { who: "gift buyers", region: "MY", life_stage: "", industry: "", needs: "", pain_points: "", objections: "" },
        platforms: ["Instagram"],
        tone: "Friendly",
        cta: "Buy now",
      },
      history: [],
    });
    expect(data.is_complete).toBe(true);
  });

  it("normalizes to a valid MarketingBrief", async () => {
    const { data } = await provider.normalizeMarketingBrief({
      knownBrief: { product_or_service: "Handmade candles", goal: "Increase sales" },
      history: [],
    });
    expect(() => marketingBriefSchema.parse(data)).not.toThrow();
  });

  it("generates copy matching the schema", async () => {
    const brief = marketingBriefSchema.parse({
      content_type: "social_post",
      product_or_service: "Handmade candles",
      short_description: "",
      key_benefits: [],
      price_or_offer: "",
      goal: "Increase sales",
      audience: { who: "gift buyers", region: "", life_stage: "", industry: "", needs: "", pain_points: "", objections: "" },
      platforms: ["Instagram", "LinkedIn"],
      tone: "Friendly",
      cta: "Buy now",
      brand_notes: "",
      language: "en",
    });
    const { data } = await provider.generateMarketingCopy({ brief });
    expect(() => generatedCopySchema.parse(data)).not.toThrow();
    expect(data.platform_variants.length).toBe(2);
  });
});
