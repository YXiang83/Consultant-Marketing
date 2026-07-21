import { NextResponse } from "next/server";
import { z } from "zod";
import { aiProvider } from "@/lib/ai";
import { generatedImageSchema } from "@/lib/ai/types";
import { supabaseServer } from "@/lib/supabase/server";
import { checkAndReserve, recordUsageEvent, refundOnFailure } from "@/lib/usage";

const bodySchema = z.object({
  projectId: z.string().uuid(),
  imageAssetId: z.string().uuid(),
  instruction: z.string().trim().min(2).max(2000),
  aspect: z.enum(["1:1", "4:5", "16:9", "9:16"]).default("4:5"),
});

function editableBase64(image: { base64: string | null; url: string | null }) {
  if (image.base64) return image.base64;
  // Do not server-fetch arbitrary stored URLs. A user-editable URL field would
  // otherwise create an SSRF path into private infrastructure.
  throw new Error("Selected image has no securely stored editable source");
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return new NextResponse("Invalid body", { status: 400 });

  const { projectId, imageAssetId, instruction, aspect } = parsed.data;
  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project || project.user_id !== user.id) return new NextResponse("Not found", { status: 404 });

  const { data: sourceAsset } = await supabase
    .from("generated_assets")
    .select("id, project_id, user_id, content")
    .eq("id", imageAssetId)
    .eq("project_id", projectId)
    .eq("asset_type", "image")
    .maybeSingle();
  if (!sourceAsset || sourceAsset.user_id !== user.id) return new NextResponse("Image not found", { status: 404 });

  const parsedImage = generatedImageSchema.safeParse(sourceAsset.content);
  if (!parsedImage.success) return new NextResponse("Image data is invalid", { status: 400 });

  const reservation = await checkAndReserve(user.id, "image", 1);
  if (!reservation.ok) {
    return NextResponse.json(
      { error: reservation.reason, details: reservation.details },
      { status: reservation.reason === "configuration_error" ? 503 : 402 },
    );
  }

  try {
    const base64 = editableBase64(parsedImage.data);
    const { data: edited, usage } = await aiProvider().editMarketingImage({
      base64,
      instruction,
      aspect,
      parentAssetId: sourceAsset.id,
    });
    if (!edited.base64 && !edited.url) throw new Error("Image edit returned no usable image");

    const { data: latest, error: latestError } = await supabase
      .from("generated_assets")
      .select("version")
      .eq("project_id", projectId)
      .eq("asset_type", "image")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw latestError;

    const { data: inserted, error: insertError } = await supabase
      .from("generated_assets")
      .insert({
        project_id: projectId,
        user_id: user.id,
        asset_type: "image",
        version: (latest?.version ?? 0) + 1,
        content: edited,
        prompt_snapshot: instruction,
        model: usage.model,
        generation_status: "ready",
        metadata: {
          parent_asset_id: sourceAsset.id,
          edit_instruction: instruction,
          aspect,
        },
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    await recordUsageEvent({
      userId: user.id,
      projectId,
      eventType: "edit_image",
      status: "success",
      usage: { ...usage, image_count: 1 },
      metadata: { parent_asset_id: sourceAsset.id, instruction, aspect },
    });

    return NextResponse.json({ image: edited, assetId: inserted.id });
  } catch (error) {
    await refundOnFailure(user.id, "image", 1);
    await recordUsageEvent({
      userId: user.id,
      projectId,
      eventType: "edit_image",
      status: "error",
      usage: { provider: aiProvider().name, model: "unknown", image_count: 0 },
      metadata: {
        parent_asset_id: sourceAsset.id,
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image edit failed" },
      { status: 500 },
    );
  }
}
