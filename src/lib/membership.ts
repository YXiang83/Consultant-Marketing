import "server-only";

import type { User } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export const MEMBERSHIP_SCHEMA = "consultant_marketing";

export type PlanCode = "trial" | "basic" | "pro";
export type MemberStatus = "pending" | "active" | "paused" | "expired";
export type MembershipAccess = {
  configured: boolean;
  allowed: boolean;
  status: MemberStatus;
  reason?: string;
  periodEnd?: string | null;
  isAdmin: boolean;
};

export type MembershipPlan = {
  id: string;
  code: PlanCode;
  name: string;
  billing_type: "one_time" | "recurring";
  initial_price_sen: number;
  renewal_price_sen: number | null;
  copy_limit: number;
  image_limit: number;
  trial_days: number | null;
  resets_monthly: boolean;
  features: Record<string, boolean>;
  is_active: boolean;
};

export type MemberListItem = {
  id: string;
  email: string;
  displayName: string;
  authCreatedAt: string | null;
  lastSignInAt: string | null;
  status: MemberStatus;
  role: "member" | "admin";
  phone: string | null;
  internalNotes: string | null;
  plan: MembershipPlan | null;
  subscriptionStatus: string | null;
  periodEnd: string | null;
  copyUsed: number;
  copyLimit: number;
  imageUsed: number;
  imageLimit: number;
};

function membershipAdmin() {
  return supabaseAdmin().schema(MEMBERSHIP_SCHEMA);
}

function normalizedAdminEmail() {
  return serverEnv().ADMIN_EMAIL?.trim().toLowerCase() ?? null;
}

export function isConfiguredAdmin(user: Pick<User, "email"> | null | undefined) {
  const configured = normalizedAdminEmail();
  return Boolean(configured && user?.email?.trim().toLowerCase() === configured);
}

export async function getCurrentAdmin(): Promise<User | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return isConfiguredAdmin(data.user) ? data.user : null;
}

export async function requireAdminUser(): Promise<User> {
  const user = await getCurrentAdmin();
  if (!user) throw new Error("FORBIDDEN: administrator access required");
  return user;
}

export async function getMembershipAccess(user: User): Promise<MembershipAccess> {
  if (isConfiguredAdmin(user)) {
    return { configured: true, allowed: true, status: "active", isAdmin: true };
  }

  const db = membershipAdmin();
  const [{ data: member, error: memberError }, { data: subscription, error: subscriptionError }] =
    await Promise.all([
      db.from("members").select("status").eq("id", user.id).maybeSingle(),
      db
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  if (memberError || subscriptionError) {
    return {
      configured: false,
      allowed: true,
      status: "pending",
      reason: memberError?.message || subscriptionError?.message,
      isAdmin: false,
    };
  }

  const status = (member?.status as MemberStatus | undefined) ?? "pending";
  const periodEnd = subscription?.current_period_end ?? null;
  const periodExpired = Boolean(periodEnd && new Date(periodEnd).getTime() <= Date.now());
  const subscriptionActive = subscription?.status === "active";
  const allowed = status === "active" && subscriptionActive && !periodExpired;

  return {
    configured: true,
    allowed,
    status: periodExpired && status === "active" ? "expired" : status,
    periodEnd,
    isAdmin: false,
  };
}

export async function getMemberAccount(userId: string) {
  const db = membershipAdmin();
  const [{ data: member, error: memberError }, { data: subscription, error: subscriptionError }, { data: balance, error: balanceError }] =
    await Promise.all([
      db
        .from("members")
        .select("id, role, status, display_name, phone, internal_notes, activated_at, paused_at")
        .eq("id", userId)
        .maybeSingle(),
      db
        .from("subscriptions")
        .select(
          "id, status, current_period_start, current_period_end, next_reset_at, auto_renew, plan:plans(id, code, name, billing_type, initial_price_sen, renewal_price_sen, copy_limit, image_limit, trial_days, resets_monthly, features, is_active)",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      db
        .from("usage_balances")
        .select("copy_used, copy_limit, image_used, image_limit, period_start, period_end")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  const firstError = memberError || subscriptionError || balanceError;
  if (firstError) {
    return { configured: false as const, error: firstError.message };
  }

  const rawPlan = subscription?.plan;
  const plan = (Array.isArray(rawPlan) ? rawPlan[0] : rawPlan) as MembershipPlan | null | undefined;
  return {
    configured: true as const,
    member,
    subscription: subscription ? { ...subscription, plan: plan ?? null } : null,
    balance,
  };
}

export async function listMembershipPlans(): Promise<MembershipPlan[]> {
  const { data, error } = await membershipAdmin()
    .from("plans")
    .select(
      "id, code, name, billing_type, initial_price_sen, renewal_price_sen, copy_limit, image_limit, trial_days, resets_monthly, features, is_active",
    )
    .order("initial_price_sen", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MembershipPlan[];
}

export async function listMembers(search = ""): Promise<MemberListItem[]> {
  const admin = supabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (authError) throw new Error(authError.message);

  const users = authData.users;
  const userIds = users.map((user) => user.id);
  const db = admin.schema(MEMBERSHIP_SCHEMA);

  const [memberResult, subscriptionResult, balanceResult] = userIds.length
    ? await Promise.all([
        db
          .from("members")
          .select("id, role, status, display_name, phone, internal_notes")
          .in("id", userIds),
        db
          .from("subscriptions")
          .select(
            "user_id, status, current_period_end, plan:plans(id, code, name, billing_type, initial_price_sen, renewal_price_sen, copy_limit, image_limit, trial_days, resets_monthly, features, is_active)",
          )
          .in("user_id", userIds),
        db
          .from("usage_balances")
          .select("user_id, copy_used, copy_limit, image_used, image_limit")
          .in("user_id", userIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];

  const firstError = memberResult.error || subscriptionResult.error || balanceResult.error;
  if (firstError) throw new Error(firstError.message);

  const memberById = new Map((memberResult.data ?? []).map((member) => [member.id, member]));
  const subscriptionById = new Map(
    (subscriptionResult.data ?? []).map((subscription) => [subscription.user_id, subscription]),
  );
  const balanceById = new Map((balanceResult.data ?? []).map((balance) => [balance.user_id, balance]));
  const needle = search.trim().toLowerCase();

  return users
    .map((user) => {
      const member = memberById.get(user.id);
      const subscription = subscriptionById.get(user.id);
      const balance = balanceById.get(user.id);
      const rawPlan = subscription?.plan;
      const plan = (Array.isArray(rawPlan) ? rawPlan[0] : rawPlan) as MembershipPlan | null | undefined;
      const email = user.email ?? "";
      const displayName = member?.display_name || user.user_metadata?.display_name || email.split("@")[0] || "Member";
      return {
        id: user.id,
        email,
        displayName,
        authCreatedAt: user.created_at ?? null,
        lastSignInAt: user.last_sign_in_at ?? null,
        status: (member?.status as MemberStatus | undefined) ?? "pending",
        role: (member?.role as "member" | "admin" | undefined) ?? "member",
        phone: member?.phone ?? null,
        internalNotes: member?.internal_notes ?? null,
        plan: plan ?? null,
        subscriptionStatus: subscription?.status ?? null,
        periodEnd: subscription?.current_period_end ?? null,
        copyUsed: balance?.copy_used ?? 0,
        copyLimit: balance?.copy_limit ?? 0,
        imageUsed: balance?.image_used ?? 0,
        imageLimit: balance?.image_limit ?? 0,
      } satisfies MemberListItem;
    })
    .filter((member) => {
      if (!needle) return true;
      return [member.email, member.displayName, member.status, member.plan?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    })
    .sort((a, b) => (b.authCreatedAt ?? "").localeCompare(a.authCreatedAt ?? ""));
}

async function rpcOrThrow<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await membershipAdmin().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function activateMembership(input: {
  userId: string;
  planCode: PlanCode;
  actorUserId: string;
  reason?: string;
}) {
  return rpcOrThrow<Record<string, unknown>>("activate_membership", {
    p_user_id: input.userId,
    p_plan_code: input.planCode,
    p_actor_user_id: input.actorUserId,
    p_reason: input.reason || null,
  });
}

export async function pauseMembership(input: {
  userId: string;
  actorUserId: string;
  reason: string;
}) {
  return rpcOrThrow<Record<string, unknown>>("pause_membership", {
    p_user_id: input.userId,
    p_actor_user_id: input.actorUserId,
    p_reason: input.reason,
  });
}

export async function resumeMembership(input: {
  userId: string;
  actorUserId: string;
  reason?: string;
}) {
  return rpcOrThrow<Record<string, unknown>>("resume_membership", {
    p_user_id: input.userId,
    p_actor_user_id: input.actorUserId,
    p_reason: input.reason || null,
  });
}

export async function adjustQuota(input: {
  userId: string;
  actorUserId: string;
  kind: "copy" | "image";
  delta: number;
  reason: string;
}) {
  return rpcOrThrow<Record<string, unknown>>("adjust_quota", {
    p_user_id: input.userId,
    p_kind: input.kind,
    p_delta: input.delta,
    p_actor_user_id: input.actorUserId,
    p_reason: input.reason,
  });
}

export async function updatePlan(input: {
  planId: string;
  actorUserId: string;
  initialPriceSen: number;
  renewalPriceSen: number | null;
  copyLimit: number;
  imageLimit: number;
  isActive: boolean;
  reason: string;
}) {
  const db = membershipAdmin();
  const { data: before, error: readError } = await db
    .from("plans")
    .select("*")
    .eq("id", input.planId)
    .single();
  if (readError) throw new Error(readError.message);

  const { data: after, error: updateError } = await db
    .from("plans")
    .update({
      initial_price_sen: input.initialPriceSen,
      renewal_price_sen: input.renewalPriceSen,
      copy_limit: input.copyLimit,
      image_limit: input.imageLimit,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.planId)
    .select("*")
    .single();
  if (updateError) throw new Error(updateError.message);

  await recordAudit({
    actorUserId: input.actorUserId,
    action: "plan_updated",
    entityType: "plan",
    entityId: input.planId,
    reason: input.reason,
    beforeState: before,
    afterState: after,
  });
  return after;
}

export async function recordAudit(input: {
  actorUserId?: string | null;
  subjectUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  reason?: string | null;
  beforeState?: unknown;
  afterState?: unknown;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await membershipAdmin().from("audit_logs").insert({
    actor_user_id: input.actorUserId ?? null,
    subject_user_id: input.subjectUserId ?? null,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    reason: input.reason ?? null,
    before_state: input.beforeState ?? null,
    after_state: input.afterState ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw new Error(error.message);
}

export async function recordAuditBestEffort(input: Parameters<typeof recordAudit>[0]) {
  try {
    await recordAudit(input);
  } catch {
    // The login path must still report its real authentication result when the
    // reviewed membership migration has not been applied yet.
  }
}
