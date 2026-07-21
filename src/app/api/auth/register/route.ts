import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAuditBestEffort } from "@/lib/membership";
import { supabaseServer } from "@/lib/supabase/server";

const bodySchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(1024),
  name: z.string().trim().min(1).max(120),
  origin: z.string().url().max(2048),
});

function emailHash(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

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
    return NextResponse.json({ error: "Please enter a valid name, email and password." }, { status: 400 });
  }

  const { email, password, name, origin } = parsed.data;
  const requestOrigin = new URL(request.url).origin;
  const redirectOrigin = new URL(origin).origin === requestOrigin ? requestOrigin : requestOrigin;
  const supabase = await supabaseServer();

  try {
    const result = await withTimeout(
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name },
          emailRedirectTo: `${redirectOrigin}/auth/callback?next=/membership-status`,
        },
      }),
      15_000,
    );

    if (result.error) {
      await recordAuditBestEffort({
        action: "registration_failed",
        reason: result.error.message,
        metadata: { email_hash: emailHash(email) },
      });
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    await recordAuditBestEffort({
      actorUserId: result.data.user?.id ?? null,
      subjectUserId: result.data.user?.id ?? null,
      action: "registration_requested",
      entityType: "auth_user",
      entityId: result.data.user?.id ?? null,
      metadata: { email_hash: emailHash(email), confirmation_required: !result.data.session },
    });

    return NextResponse.json({
      ok: true,
      message: result.data.session
        ? "Account created. Your membership is waiting for administrator activation."
        : "Check your email to confirm your account, then log in.",
      next: result.data.session ? "/membership-status" : null,
    });
  } catch (error) {
    const timeout = error instanceof Error && error.message === "AUTH_TIMEOUT";
    await recordAuditBestEffort({
      action: timeout ? "registration_timeout" : "registration_failed",
      reason: timeout ? "Supabase Auth did not respond within 15 seconds" : error instanceof Error ? error.message : "Unknown registration error",
      metadata: { email_hash: emailHash(email) },
    });
    return NextResponse.json(
      { error: timeout ? "Registration took too long. Please try again." : "Registration could not be completed." },
      { status: timeout ? 504 : 500 },
    );
  }
}
