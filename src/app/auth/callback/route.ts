import { NextResponse, type NextRequest } from "next/server";
import { recordAuditBestEffort } from "@/lib/membership";
import { supabaseServer } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/home";
  return value;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (!code) {
    await recordAuditBestEffort({
      action: "auth_callback_failed",
      reason: "Authorization code was missing",
      metadata: { next },
    });
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const supabase = await supabaseServer();
  const result = await supabase.auth.exchangeCodeForSession(code);
  if (result.error || !result.data.user) {
    await recordAuditBestEffort({
      action: "auth_callback_failed",
      reason: result.error?.message || "Session exchange did not return a user",
      metadata: { next },
    });
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  await recordAuditBestEffort({
    actorUserId: result.data.user.id,
    subjectUserId: result.data.user.id,
    action: "auth_callback_succeeded",
    entityType: "auth_user",
    entityId: result.data.user.id,
    metadata: { next },
  });

  return NextResponse.redirect(new URL(next, url.origin));
}
