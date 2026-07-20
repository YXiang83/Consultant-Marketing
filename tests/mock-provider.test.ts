import { describe, expect, it } from "vitest";
import { mockProvider } from "@/lib/ai/providers/mock";
import { marketingBriefSchema, generatedCopySchema } from "@/lib/ai/types";

describe("mockProvider", () => {
  const provider = mockProvider();

  it("asks for a messy product description first", async () => {
    const { data } = await provider.determineNextQuestion({ knownBrief: {}, history: [] });
    expect(data.step).toBe("product");
    expect(data.input_type).toBe("long_text");
    expect(data.is_complete).toBe(false);
  });

  it("recommends content or sales after product input", async () => {
    const { data } = await provider.determineNextQuestion({
      knownBrief: { product_or_service: "新山 CIQ 公寓，想收到买家询问" },
      history: [],
    });
    expect(data.step).toBe("copy_mode");
    expect(data.options).toEqual(["内容型", "销售型"]);
    expect(data.recommended_option).toBe("销售型");
    expect(data.recommendation_reason.length).toBeGreaterThan(0);
  });

  it("offers three angles and recommends one", async () => {
    const { data } = await provider.determineNextQuestion({
      knownBrief: {
        product_or_service: "新山 CIQ 公寓",
        copy_mode: "sales",
      },
      history: [],
    });
    expect(data.step).toBe("angle");
    expect(data.options).toHaveLength(3);
    expect(data.options).toContain(data.recommended_option);
  });

  it("marks complete after mode and angle are selected", async () => {
    const { data } = await provider.determineNextQuestion({
      knownBrief: {
        product_or_service: "新山 CIQ 公寓",
        copy_mode: "sales",
        selected_angle: "从客户现在的麻烦切入",
      },
      history: [],
    });
    expect(data.is_complete).toBe(true);
  });

  it("normalizes to a valid MarketingBrief", async () => {
    const { data } = await provider.normalizeMarketingBrief({
      knownBrief: {
        product_or_service: "Handmade candles",
        copy_mode: "content",
        selected_angle: "教客户判断这类产品",
      },
      history: [],
    });
    expect(() => marketingBriefSchema.parse(data)).not.toThrow();
    expect(data.copy_mode).toBe("content");
  });

  it("generates copy matching the schema", async () => {
    const brief = marketingBriefSchema.parse({
      content_type: "ad_copy",
      copy_mode: "sales",
      selected_angle: "直接讲最实际的好处",
      product_or_service: "Handmade candles",
      short_description: "手工制作，适合作为礼物",
      key_benefits: ["送礼时比较有个人感"],
      price_or_offer: "",
      goal: "收到更多询问",
      audience: { who: "gift buyers", region: "", life_stage: "", industry: "", needs: "", pain_points: "", objections: "" },
      platforms: ["Instagram", "WhatsApp"],
      tone: "Friendly",
      cta: "Send a message",
      brand_notes: "",
      language: "en",
    });
    const { data } = await provider.generateMarketingCopy({ brief });
    expect(() => generatedCopySchema.parse(data)).not.toThrow();
    expect(data.platform_variants.length).toBe(2);
  });
});
