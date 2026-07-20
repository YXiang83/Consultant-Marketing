import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { aiProvider } from "@/lib/ai";
import { partialBriefSchema } from "@/lib/ai/types";

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  brief: partialBriefSchema.optional(),
});

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return new NextResponse("Unauthorized", { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return new NextResponse("Invalid body", { status: 400 });

  const { data: session, error: sErr } = await supabase
    .from("consultant_sessions")
    .select("id, structured_brief, status")
    .eq("id", parsed.data.sessionId)
    .maybeSingle();
  if (sErr || !session) return new NextResponse("Not found", { status: 404 });

  const knownBrief = parsed.data.brief ?? (session.structured_brief as z.infer<typeof partialBriefSchema>) ?? {};

  const { data: messages } = await supabase
    .from("consultant_messages")
    .select("role, structured_data")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true });

  const history = (messages ?? [])
    .filter((m) => m.role === "user")
    .map((m) => (m.structured_data ?? {}) as { step: string; answer: string | string[] });

  const { data: question } = await aiProvider().determineNextQuestion({ knownBrief, history });

  await supabase
    .from("consultant_sessions")
    .update({
      current_step: question.step,
      status: question.is_complete ? "ready" : "active",
      structured_brief: knownBrief,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  return NextResponse.json({ question, brief: knownBrief });
}
