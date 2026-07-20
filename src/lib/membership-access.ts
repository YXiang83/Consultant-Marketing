import "server-only";

import type { User } from "@supabase/supabase-js";
import { isConfiguredAdmin, type MemberStatus, type MembershipAccess, type MembershipPlan } from "@/lib/membership";
import { APP_DB_SCHEMA, supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export async function getStrictMembershipAccess(user: User): Promise<MembershipAccess> {
  if (isConfiguredAdmin(user)) {
    return { configured: true, allowed: true, status: "active", isAdmin: true };
  }

  try {
    const { error: refreshError } = await supabaseAdmin().rpc("refresh_membership_period", {
      p_user_id: user.id,
    });
    if (refreshError) {
      return {
        configured: false,
        allowed: false,
        status: "pending",
        reason: refreshError.message,
        isAdmin: false,
      };
    }
  } catch (error) {
    return {
      configured: false,
      allowed: false,
      status: "pending",
      reason: error instanceof Error ? error.message : "Membership period could not be verified",
      isAdmin: false,
    };
  }

  const supabase = await supabaseServer();
  const db = supabase.schema(APP_DB_SCHEMA);
  const [{ data: member, error: memberError }, { data: subscription, error: subscriptionError }] =
    await Promise.all([
      db.from("members").select("role, status").eq("id", user.id).maybeSingle(),
      db
        .from("subscriptions")
        .select("status, current_period_end, plan:plans(billing_type, resets_monthly)")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  if (memberError || subscriptionError) {
    return {
      configured: false,
      allowed: false,
      status: "pending",
      reason: memberError?.message || subscriptionError?.message,
      isAdmin: false,
    };
  }

  const role = member?.role as "member" | "admin" | undefined;
  if (role === "admin") {
    return { configured: true, allowed: true, status: "active", isAdmin: true };
  }

  const status = (member?.status as MemberStatus | undefined) ?? "pending";
  const periodEnd = subscription?.current_period_end ?? null;
  const rawPlan = subscription?.plan;
  const plan = (Array.isArray(rawPlan) ? rawPlan[0] : rawPlan) as
    | Pick<MembershipPlan, "billing_type" | "resets_monthly">
    | null
    | undefined;
  const periodExpired = Boolean(periodEnd && new Date(periodEnd).getTime() <= Date.now());
  const recurring = Boolean(plan?.billing_type === "recurring" && plan.resets_monthly);
  const subscriptionActive = subscription?.status === "active";
  const allowed = status === "active" && subscriptionActive && (recurring || !periodExpired);

  return {
    configured: true,
    allowed,
    status: periodExpired && !recurring && status === "active" ? "expired" : status,
    periodEnd,
    isAdmin: false,
  };
}
