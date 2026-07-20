import { NextResponse, type NextRequest } from "next/server";
import { recordAuditBestEffort } from "@/lib/membership";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    await recordAuditBestEffort({
      actorUserId: data.user.id,
      subjectUserId: data.user.id,
      action: "logout",
      entityType: "auth_user",
      entityId: data.user.id,
    });
  }
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
