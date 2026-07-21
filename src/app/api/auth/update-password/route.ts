import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAuditBestEffort } from "@/lib/membership";
import { supabaseServer } from "@/lib/supabase/server";

const bodySchema = z.object({
  password: z.string().min(8).max(1024),
});

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("AUTH_TIMEOUT")), milliseconds);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) {
    return NextResponse.json({ error: "The recovery link is invalid or has expired." }, { status: 401 });
  }

  try {
    const result = await withTimeout(
      supabase.auth.updateUser({ password: parsed.data.password }),
      15_000,
    );

    if (result.error) {
      await recordAuditBestEffort({
        actorUserId: user.id,
        subjectUserId: user.id,
        action: "password_update_failed",
        entityType: "auth_user",
        entityId: user.id,
        reason: result.error.message,
      });
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    await recordAuditBestEffort({
      actorUserId: user.id,
      subjectUserId: user.id,
      action: "password_updated",
      entityType: "auth_user",
      entityId: user.id,
    });

    return NextResponse.json({ ok: true, next: "/membership-status" });
  } catch (error) {
    const timeout = error instanceof Error && error.message === "AUTH_TIMEOUT";
    await recordAuditBestEffort({
      actorUserId: user.id,
      subjectUserId: user.id,
      action: timeout ? "password_update_timeout" : "password_update_failed",
      entityType: "auth_user",
      entityId: user.id,
      reason: timeout ? "Supabase Auth did not respond within 15 seconds" : error instanceof Error ? error.message : "Unknown password update error",
    });
    return NextResponse.json(
      { error: timeout ? "The request took too long. Please try again." : "The password could not be updated." },
      { status: timeout ? 504 : 500 },
    );
  }
}
