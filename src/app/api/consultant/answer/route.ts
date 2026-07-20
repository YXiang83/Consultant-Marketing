import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import type { PartialBrief } from "@/lib/ai/types";

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  step: z.string(),
  answer: z.union([z.string(), z.array(z.string())]),
});

function mergeIntoBrief(brief: PartialBrief, step: string, answer: string | string[]): PartialBrief {
  const b: PartialBrief = { ...brief, audience: { ...brief.audience } };
  const text = Array.isArray(answer) ? answer.join(", ") : answer;

  switch (step) {
    case "product":
      b.product_or_service = text;
      b.short_description = text;
      break;
    case "copy_mode":
      b.copy_mode = text === "内容型" || text === "content" ? "content" : "sales";
      b.content_type = b.copy_mode === "content" ? "social_post" : "ad_copy";
      b.goal = b.copy_mode === "content" ? "建立信任" : "收到更多询问";
      break;
    case "angle":
      b.selected_angle = text;
      break;
    case "goal":
      b.goal = text;
      break;
    case "audience":
      b.audience = { ...(b.audience ?? {}), who: text };
      break;
    case "platforms":
      b.platforms = Array.isArray(answer) ? answer : text.split(",").map((s) => s.trim()).filter(Boolean);
      break;
    case "tone":
      b.tone = text;
      break;
    case "cta":
      b.cta = text;
      break;
  }

  return b;
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return new NextResponse("Unauthorized", { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return new NextResponse("Invalid body", { status: 400 });

  const { data: session } = await supabase
    .from("consultant_sessions")
    .select("id, structured_brief")
    .eq("id", parsed.data.sessionId)
    .maybeSingle();
  if (!session) return new NextResponse("Not found", { status: 404 });

  const current = (session.structured_brief as PartialBrief) ?? {};
  const updated = mergeIntoBrief(current, parsed.data.step, parsed.data.answer);

  await supabase.from("consultant_messages").insert({
    session_id: session.id,
    role: "user",
    content: Array.isArray(parsed.data.answer) ? parsed.data.answer.join(", ") : parsed.data.answer,
    structured_data: { step: parsed.data.step, answer: parsed.data.answer },
  });

  await supabase
    .from("consultant_sessions")
    .update({ structured_brief: updated, updated_at: new Date().toISOString() })
    .eq("id", session.id);

  return NextResponse.json({ brief: updated });
}
