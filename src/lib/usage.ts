import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { MEMBERSHIP_SCHEMA } from "@/lib/membership";
import type { UsageMeta } from "@/lib/ai/types";

export type UsageKind = "copy" | "image";

export type UsageCheck =
  | { ok: true; remaining: { copy: number; image: number }; balanceId: string; periodEnd: string }
  | {
      ok: false;
      reason:
        | "no_subscription"
        | "membership_inactive"
        | "membership_expired"
        | "no_balance"
        | "over_limit"
        | "configuration_error";
      details?: string;
    };

type ReservationResponse = {
  ok: boolean;
  reason?: string;
  balance_id?: string;
  period_end?: string;
  remaining?: { copy?: number; image?: number };
};

function membershipDb() {
  return supabaseAdmin().schema(MEMBERSHIP_SCHEMA);
}

function normalizeFailureReason(reason: string | undefined): Exclude<UsageCheck, { ok: true }>["reason"] {
  if (reason === "membership_inactive") return "membership_inactive";
  if (reason === "membership_expired") return "membership_expired";
  if (reason === "no_balance") return "no_balance";
  if (reason === "over_limit") return "over_limit";
  if (reason === "no_subscription") return "no_subscription";
  return "configuration_error";
}

export async function checkAndReserve(userId: string, kind: UsageKind, amount = 1): Promise<UsageCheck> {
  const { data, error } = await membershipDb().rpc("reserve_usage", {
    p_user_id: userId,
    p_kind: kind,
    p_amount: amount,
  });

  if (error) {
    return { ok: false, reason: "configuration_error", details: error.message };
  }

  const result = data as ReservationResponse | null;
  if (!result?.ok || !result.balance_id || !result.period_end) {
    return {
      ok: false,
      reason: normalizeFailureReason(result?.reason),
      details: result?.reason,
    };
  }

  return {
    ok: true,
    remaining: {
      copy: result.remaining?.copy ?? 0,
      image: result.remaining?.image ?? 0,
    },
    balanceId: result.balance_id,
    periodEnd: result.period_end,
  };
}

export async function refundOnFailure(userId: string, kind: UsageKind, amount = 1) {
  await membershipDb().rpc("refund_usage", {
    p_user_id: userId,
    p_kind: kind,
    p_amount: amount,
    p_reason: "Generation failed or returned no usable output",
  });
}

export async function recordUsageEvent(input: {
  userId: string;
  projectId: string | null;
  eventType: string;
  status: "success" | "error";
  usage: UsageMeta;
  metadata?: Record<string, unknown>;
}) {
  const kind: UsageKind | null = input.eventType.includes("image") ? "image" : input.eventType.includes("copy") ? "copy" : null;
  const amount = kind === "image" ? input.usage.image_count ?? 1 : kind === "copy" ? 1 : 0;

  await membershipDb().from("usage_events").insert({
    user_id: input.userId,
    project_id: input.projectId,
    event_type: input.eventType,
    usage_kind: kind,
    amount,
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
