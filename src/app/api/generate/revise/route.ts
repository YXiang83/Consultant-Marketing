import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { aiProvider } from "@/lib/ai";
import {
  marketingBriefSchema,
  type GeneratedCopy,
  type RevisionKind,
} from "@/lib/ai/types";
import { checkAndReserve, recordUsageEvent, refundOnFailure } from "@/lib/usage";

const bodySchema = z.object({
  projectId: z.string().uuid(),
  kind: z.enum([
    "shorter",
    "longer",
    "different_tone",
    "different_platform",
    "different_audience",
    "regenerate",
  ]),
  instruction: z.string().optional(),
});

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return new NextResponse("Invalid body", { status: 400 });

  const { projectId, kind, instruction } = parsed.data;

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project || project.user_id !== user.id) return new NextResponse("Not found", { status: 404 });

  const { data: session } = await supabase
    .from("consultant_sessions")
    .select("structured_brief")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const parsedBrief = marketingBriefSchema.safeParse(session?.structured_brief);
  if (!parsedBrief.success) return new NextResponse("Brief not ready", { status: 400 });
  const brief = parsedBrief.data;

  const { data: previousAsset } = await supabase
    .from("generated_assets")
    .select("content, version")
    .eq("project_id", projectId)
    .eq("asset_type", "copy")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const previous = previousAsset?.content as GeneratedCopy | undefined;
  if (!previous) return new NextResponse("No copy to revise", { status: 400 });

  const reservation = await checkAndReserve(user.id, "copy", 1);
  if (!reservation.ok) {
    return NextResponse.json({ error: reservation.reason }, { status: 402 });
  }

  try {
    const { data: revised, usage } = await aiProvider().reviseGeneratedContent({
      brief,
      previous,
      kind: kind as RevisionKind,
      instruction,
    });

    await supabase.from("generated_assets").insert({
      project_id: projectId,
      user_id: user.id,
      asset_type: "copy",
      version: (previousAsset?.version ?? 1) + 1,
      content: revised,
      model: usage.model,
      generation_status: "ready",
      metadata: { revision_kind: kind },
    });

    await recordUsageEvent({
      userId: user.id,
      projectId,
      eventType: "revise_copy",
      status: "success",
      usage,
      metadata: { kind },
    });

    return NextResponse.json({ copy: revised });
  } catch (err) {
    await refundOnFailure(user.id, "copy", 1);
    await recordUsageEvent({
      userId: user.id,
      projectId,
      eventType: "revise_copy",
      status: "error",
      usage: { provider: aiProvider().name, model: "unknown" },
      metadata: { message: err instanceof Error ? err.message : String(err) },
    });
    return new NextResponse("Revision failed", { status: 500 });
  }
}
