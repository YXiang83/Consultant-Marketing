import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { aiProvider } from "@/lib/ai";
import type { PartialBrief } from "@/lib/ai/types";

const bodySchema = z.object({ sessionId: z.string().uuid() });

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return new NextResponse("Unauthorized", { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return new NextResponse("Invalid body", { status: 400 });

  const { data: session } = await supabase
    .from("consultant_sessions")
    .select("id, structured_brief, project_id")
    .eq("id", parsed.data.sessionId)
    .maybeSingle();
  if (!session) return new NextResponse("Not found", { status: 404 });

  const known = (session.structured_brief as PartialBrief) ?? {};
  const { data: messages } = await supabase
    .from("consultant_messages")
    .select("role, structured_data")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true });

  const history = (messages ?? [])
    .filter((m) => m.role === "user")
    .map((m) => (m.structured_data ?? {}) as { step: string; answer: string | string[] });

  const { data: brief } = await aiProvider().normalizeMarketingBrief({ knownBrief: known, history });

  await supabase
    .from("consultant_sessions")
    .update({ structured_brief: brief, status: "ready", updated_at: new Date().toISOString() })
    .eq("id", session.id);

  await supabase
    .from("projects")
    .update({
      title: brief.product_or_service.slice(0, 60),
      platform: brief.platforms[0] ?? null,
      content_type: brief.content_type,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.project_id);

  return NextResponse.json({ brief });
}
