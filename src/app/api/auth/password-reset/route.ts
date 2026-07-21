import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAuditBestEffort } from "@/lib/membership";
import { supabaseServer } from "@/lib/supabase/server";

const bodySchema = z.object({
  email: z.string().trim().email().max(320),
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
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const { email } = parsed.data;
  const origin = new URL(request.url).origin;
  const supabase = await supabaseServer();

  try {
    const result = await withTimeout(
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      }),
      15_000,
    );

    await recordAuditBestEffort({
      action: result.error ? "password_reset_failed" : "password_reset_requested",
      reason: result.error?.message ?? null,
      metadata: { email_hash: emailHash(email) },
    });

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: "If an account exists, we've sent a reset link.",
    });
  } catch (error) {
    const timeout = error instanceof Error && error.message === "AUTH_TIMEOUT";
    await recordAuditBestEffort({
      action: timeout ? "password_reset_timeout" : "password_reset_failed",
      reason: timeout ? "Supabase Auth did not respond within 15 seconds" : error instanceof Error ? error.message : "Unknown password reset error",
      metadata: { email_hash: emailHash(email) },
    });
    return NextResponse.json(
      { error: timeout ? "The request took too long. Please try again." : "The reset request could not be completed." },
      { status: timeout ? 504 : 500 },
    );
  }
}
