/**
 * CanvaAdapter placeholder — real integration must go through Canva's official APIs
 * (Connect API / Apps SDK / design deep links). See docs/DECISIONS.md.
 * Do NOT fabricate Canva links or claim integration completeness from this stub.
 */
export type CanvaExportRequest = {
  headline: string;
  body: string;
  imageBase64: string | null;
  imageUrl: string | null;
};

export type CanvaExportResult = { status: "not_configured" } | { status: "prepared"; payload: unknown };

export interface CanvaAdapter {
  isConfigured(): boolean;
  export(input: CanvaExportRequest): Promise<CanvaExportResult>;
}

export function canvaAdapter(): CanvaAdapter {
  return {
    isConfigured() {
      return false;
    },
    async export() {
      return { status: "not_configured" };
    },
  };
}
