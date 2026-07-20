import "server-only";

import { recordAudit } from "@/lib/membership";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function updateMemberProfile(input: {
  userId: string;
  actorUserId: string;
  displayName: string | null;
  phone: string | null;
  internalNotes: string | null;
  reason: string;
}) {
  const db = supabaseAdmin();
  const { data: before, error: readError } = await db
    .from("members")
    .select("id, role, status, display_name, phone, internal_notes")
    .eq("id", input.userId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const { data: after, error: writeError } = await db
    .from("members")
    .upsert(
      {
        id: input.userId,
        display_name: input.displayName,
        phone: input.phone,
        internal_notes: input.internalNotes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("id, role, status, display_name, phone, internal_notes")
    .single();
  if (writeError) throw new Error(writeError.message);

  await recordAudit({
    actorUserId: input.actorUserId,
    subjectUserId: input.userId,
    action: "member_profile_updated",
    entityType: "member",
    entityId: input.userId,
    reason: input.reason,
    beforeState: before,
    afterState: after,
  });

  return after;
}
