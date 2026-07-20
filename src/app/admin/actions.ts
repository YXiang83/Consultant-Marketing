"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  activateMembership,
  adjustQuota,
  pauseMembership,
  requireAdminUser,
  resumeMembership,
  updatePlan,
} from "@/lib/membership";

const uuidSchema = z.string().uuid();
const planCodeSchema = z.enum(["trial", "basic", "pro"]);
const reasonSchema = z.string().trim().min(3).max(500);

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function integer(formData: FormData, name: string) {
  const parsed = Number(text(formData, name));
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be a whole number`);
  return parsed;
}

function moneyToSen(formData: FormData, name: string): number;
function moneyToSen(formData: FormData, name: string, nullable: true): number | null;
function moneyToSen(formData: FormData, name: string, nullable = false): number | null {
  const raw = text(formData, name).trim();
  if (nullable && raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a valid amount`);
  return Math.round(value * 100);
}

export async function activateMemberAction(formData: FormData) {
  const admin = await requireAdminUser();
  const userId = uuidSchema.parse(text(formData, "userId"));
  const planCode = planCodeSchema.parse(text(formData, "planCode"));
  const reason = reasonSchema.parse(text(formData, "reason"));

  await activateMembership({
    userId,
    planCode,
    actorUserId: admin.id,
    reason,
  });
  revalidatePath("/admin/members");
  revalidatePath("/account");
}

export async function pauseMemberAction(formData: FormData) {
  const admin = await requireAdminUser();
  const userId = uuidSchema.parse(text(formData, "userId"));
  const reason = reasonSchema.parse(text(formData, "reason"));
  await pauseMembership({ userId, actorUserId: admin.id, reason });
  revalidatePath("/admin/members");
}

export async function resumeMemberAction(formData: FormData) {
  const admin = await requireAdminUser();
  const userId = uuidSchema.parse(text(formData, "userId"));
  const reason = reasonSchema.parse(text(formData, "reason"));
  await resumeMembership({ userId, actorUserId: admin.id, reason });
  revalidatePath("/admin/members");
}

export async function adjustQuotaAction(formData: FormData) {
  const admin = await requireAdminUser();
  const userId = uuidSchema.parse(text(formData, "userId"));
  const kind = z.enum(["copy", "image"]).parse(text(formData, "kind"));
  const delta = z.number().int().min(-10000).max(10000).refine((value) => value !== 0).parse(integer(formData, "delta"));
  const reason = reasonSchema.parse(text(formData, "reason"));

  await adjustQuota({ userId, actorUserId: admin.id, kind, delta, reason });
  revalidatePath("/admin/members");
  revalidatePath("/account");
}

export async function updatePlanAction(formData: FormData) {
  const admin = await requireAdminUser();
  const planId = uuidSchema.parse(text(formData, "planId"));
  const initialPriceSen = moneyToSen(formData, "initialPrice");
  const renewalPriceSen = moneyToSen(formData, "renewalPrice", true);
  const copyLimit = z.number().int().min(0).max(100000).parse(integer(formData, "copyLimit"));
  const imageLimit = z.number().int().min(0).max(100000).parse(integer(formData, "imageLimit"));
  const reason = reasonSchema.parse(text(formData, "reason"));
  const isActive = formData.get("isActive") === "on";

  await updatePlan({
    planId,
    actorUserId: admin.id,
    initialPriceSen,
    renewalPriceSen,
    copyLimit,
    imageLimit,
    isActive,
    reason,
  });
  revalidatePath("/admin/plans");
  revalidatePath("/admin/members");
}
