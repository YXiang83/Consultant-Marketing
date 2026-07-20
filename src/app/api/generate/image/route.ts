import { NextResponse } from "next/server";
import { z } from "zod";
import { aiProvider } from "@/lib/ai";
import { marketingBriefSchema, type GeneratedCopy } from "@/lib/ai/types";
import { supabaseServer } from "@/lib/supabase/server";
import { checkAndReserve, recordUsageEvent, refundOnFailure } from "@/lib/usage";

const bodySchema = z.object({
  projectId: z.string().uuid(),
  count: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(4),
  aspect: z.enum(["1:1", "4:5", "16:9", "9:16"]).default("4:5"),
});

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return new NextResponse("Invalid body", { status: 400 });

  const { projectId, count, aspect } = parsed.data;

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

  const reservation = await checkAndReserve(user.id, "image", count);
  if (!reservation.ok) {
    return NextResponse.json({ error: reservation.reason }, { status: 402 });
  }

  let refundableReservation: number = count;

  try {
    const provider = aiProvider();
    const { data: directions, usage: directionUsage } = await provider.generateImageDirections({
      brief,
      copy,
      count,
    });
    const { data: images, usage: imageUsage } = await provider.generateMarketingImages({
      directions,
      aspect,
    });

    const successfulImages = images.filter((image) => image.base64 || image.url);
    const successfulCount = successfulImages.length;
    const partialRefund = Math.max(0, count - successfulCount);
    if (partialRefund > 0) {
      await refundOnFailure(user.id, "image", partialRefund);
      refundableReservation -= partialRefund;
    }
    if (successfulCount === 0) {
      throw new Error("Image generation returned no usable images");
    }

    const { error: conceptError } = await supabase.from("generated_assets").insert({
      project_id: projectId,
      user_id: user.id,
      asset_type: "concept",
      content: { directions, aspect },
      model: directionUsage.model,
      generation_status: "ready",
      metadata: { requested_count: count, successful_count: successfulCount },
    });
    if (conceptError) throw conceptError;

    const { error: imageInsertError } = await supabase.from("generated_assets").insert(
      successfulImages.map((image, index) => ({
        project_id: projectId,
        user_id: user.id,
        asset_type: "image",
        version: index + 1,
        content: image,
        prompt_snapshot: image.prompt,
        model: image.model,
        generation_status: "ready",
        metadata: {
          direction_id: image.direction_id,
          direction_title: image.direction_title,
          aspect,
          requested_batch_size: count,
          successful_batch_size: successfulCount,
        },
      })),
    );
    if (imageInsertError) throw imageInsertError;

    await recordUsageEvent({
      userId: user.id,
      projectId,
      eventType: "generate_image",
      status: "success",
      usage: { ...imageUsage, image_count: successfulCount },
      metadata: {
        requested_count: count,
        successful_count: successfulCount,
        refunded_count: partialRefund,
        aspect,
      },
    });

    refundableReservation = 0;
    return NextResponse.json({ images: successfulImages, directions });
  } catch (err) {
    if (refundableReservation > 0) {
      await refundOnFailure(user.id, "image", refundableReservation);
      refundableReservation = 0;
    }
    const message = err instanceof Error ? err.message : String(err);
    await recordUsageEvent({
      userId: user.id,
      projectId,
      eventType: "generate_image",
      status: "error",
      usage: { provider: aiProvider().name, model: "unknown", image_count: 0 },
      metadata: { message, requested_count: count, aspect },
    });
    return NextResponse.json({ error: message || "Image generation failed" }, { status: 500 });
  }
}
