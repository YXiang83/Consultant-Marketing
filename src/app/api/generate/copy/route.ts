import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { aiProvider } from "@/lib/ai";
import { marketingBriefSchema } from "@/lib/ai/types";
import { checkAndReserve, recordUsageEvent, refundOnFailure } from "@/lib/usage";

const bodySchema = z.object({
  projectId: z.string().uuid(),
  brief: marketingBriefSchema,
});

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return new NextResponse("Invalid body", { status: 400 });

  const { projectId, brief } = parsed.data;

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project || project.user_id !== user.id) return new NextResponse("Not found", { status: 404 });

  const reservation = await checkAndReserve(user.id, "copy", 1);
  if (!reservation.ok) {
    return NextResponse.json(
      { error: reservation.reason, details: reservation.details },
      { status: reservation.reason === "configuration_error" ? 503 : 402 },
    );
  }

  try {
    const { data: copy, usage } = await aiProvider().generateMarketingCopy({ brief });
    if (!copy?.variants?.length) throw new Error("Copy generation returned no usable variants");

    const { error: assetError } = await supabase.from("generated_assets").insert({
      project_id: projectId,
      user_id: user.id,
      asset_type: "copy",
      content: copy,
      model: usage.model,
      generation_status: "ready",
    });
    if (assetError) throw assetError;

    const { error: projectError } = await supabase
      .from("projects")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", projectId);
    if (projectError) throw projectError;

    await recordUsageEvent({
      userId: user.id,
      projectId,
      eventType: "generate_copy",
      status: "success",
      usage,
      metadata: { variant_count: copy.variants.length },
    });

    return NextResponse.json({ copy });
  } catch (err) {
    await refundOnFailure(user.id, "copy", 1);
    await recordUsageEvent({
      userId: user.id,
      projectId,
      eventType: "generate_copy",
      status: "error",
      usage: { provider: aiProvider().name, model: "unknown" },
      metadata: { message: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 },
    );
  }
}
