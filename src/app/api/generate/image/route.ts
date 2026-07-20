import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { aiProvider } from "@/lib/ai";
import { marketingBriefSchema, type GeneratedCopy } from "@/lib/ai/types";
import { checkAndReserve, recordUsageEvent, refundOnFailure } from "@/lib/usage";

const bodySchema = z.object({ projectId: z.string().uuid() });

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return new NextResponse("Invalid body", { status: 400 });

  const { projectId } = parsed.data;

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

  const { data: copyAsset } = await supabase
    .from("generated_assets")
    .select("content")
    .eq("project_id", projectId)
    .eq("asset_type", "copy")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const copy = copyAsset?.content as GeneratedCopy | undefined;
  if (!copy) return new NextResponse("Copy required before image", { status: 400 });

  const reservation = await checkAndReserve(user.id, "image", 1);
  if (!reservation.ok) {
    return NextResponse.json({ error: reservation.reason }, { status: 402 });
  }

  try {
    const provider = aiProvider();
    const { data: concept, usage: conceptUsage } = await provider.generateImageConcept({ brief, copy });
    const { data: image, usage: imageUsage } = await provider.generateMarketingImage({
      prompt: concept.image_prompt,
      aspect: "1:1",
    });

    await supabase.from("generated_assets").insert({
      project_id: projectId,
      user_id: user.id,
      asset_type: "concept",
      content: concept,
      model: conceptUsage.model,
      generation_status: "ready",
    });

    await supabase.from("generated_assets").insert({
      project_id: projectId,
      user_id: user.id,
      asset_type: "image",
      content: image,
      prompt_snapshot: concept.image_prompt,
      model: imageUsage.model,
      generation_status: image.base64 || image.url ? "ready" : "failed",
    });

    await recordUsageEvent({
      userId: user.id,
      projectId,
      eventType: "generate_image",
      status: image.base64 || image.url ? "success" : "error",
      usage: imageUsage,
    });

    return NextResponse.json({ image, concept });
  } catch (err) {
    await refundOnFailure(user.id, "image", 1);
    await recordUsageEvent({
      userId: user.id,
      projectId,
      eventType: "generate_image",
      status: "error",
      usage: { provider: aiProvider().name, model: "unknown" },
      metadata: { message: err instanceof Error ? err.message : String(err) },
    });
    return new NextResponse("Image generation failed", { status: 500 });
  }
}
