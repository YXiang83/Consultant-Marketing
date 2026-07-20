import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { UsageMeta } from "@/lib/ai/types";

export type UsageKind = "copy" | "image";

export type UsageCheck =
  | { ok: true; remaining: { copy: number; image: number }; balanceId: string; periodEnd: string }
  | { ok: false; reason: "no_subscription" | "over_limit"; details?: string };

export async function checkAndReserve(userId: string, kind: UsageKind, amount = 1): Promise<UsageCheck> {
  const admin = supabaseAdmin();
  const { data: bal, error } = await admin
    .from("usage_balances")
    .select("id, copy_used, image_used, copy_limit, image_limit, period_start, period_end")
    .eq("user_id", userId)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, reason: "no_subscription", details: error.message };
  if (!bal) return { ok: false, reason: "no_subscription" };

  const used = kind === "copy" ? bal.copy_used : bal.image_used;
  const limit = kind === "copy" ? bal.copy_limit : bal.image_limit;
  if (used + amount > limit) return { ok: false, reason: "over_limit" };

  const patch =
    kind === "copy"
      ? { copy_used: used + amount, updated_at: new Date().toISOString() }
      : { image_used: used + amount, updated_at: new Date().toISOString() };

  const { error: upErr } = await admin.from("usage_balances").update(patch).eq("id", bal.id).eq(kind === "copy" ? "copy_used" : "image_used", used);
  if (upErr) return { ok: false, reason: "over_limit", details: upErr.message };

  return {
    ok: true,
    remaining: {
      copy: bal.copy_limit - (kind === "copy" ? used + amount : bal.copy_used),
      image: bal.image_limit - (kind === "image" ? used + amount : bal.image_used),
    },
    balanceId: bal.id,
    periodEnd: bal.period_end,
  };
}

export async function refundOnFailure(userId: string, kind: UsageKind, amount = 1) {
  const admin = supabaseAdmin();
  const { data: bal } = await admin
    .from("usage_balances")
    .select("id, copy_used, image_used")
    .eq("user_id", userId)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!bal) return;
  const patch =
    kind === "copy"
      ? { copy_used: Math.max(0, bal.copy_used - amount), updated_at: new Date().toISOString() }
      : { image_used: Math.max(0, bal.image_used - amount), updated_at: new Date().toISOString() };
  await admin.from("usage_balances").update(patch).eq("id", bal.id);
}

export async function recordUsageEvent(input: {
  userId: string;
  projectId: string | null;
  eventType: string;
  status: "success" | "error";
  usage: UsageMeta;
  metadata?: Record<string, unknown>;
}) {
  const admin = supabaseAdmin();
  await admin.from("usage_events").insert({
    user_id: input.userId,
    project_id: input.projectId,
    event_type: input.eventType,
    provider: input.usage.provider,
    model: input.usage.model,
    input_tokens: input.usage.input_tokens ?? null,
    output_tokens: input.usage.output_tokens ?? null,
    image_count: input.usage.image_count ?? null,
    estimated_cost: input.usage.estimated_cost ?? null,
    request_id: input.usage.request_id ?? null,
    status: input.status,
    metadata: input.metadata ?? {},
  });
}
