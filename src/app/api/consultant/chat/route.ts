import { NextResponse } from "next/server";
import { z } from "zod";
import { aiProvider } from "@/lib/ai";
import { partialBriefSchema, type PartialBrief } from "@/lib/ai/types";
import { supabaseServer } from "@/lib/supabase/server";

const postBodySchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().trim().min(1).max(10000),
});

function mergeBrief(current: PartialBrief, patch: PartialBrief): PartialBrief {
  return partialBriefSchema.parse({
    ...current,
    ...patch,
    audience:
      current.audience || patch.audience
        ? { ...(current.audience ?? {}), ...(patch.audience ?? {}) }
        : undefined,
  });
}

async function getOwnedSession(sessionId: string, userId: string) {
  const supabase = await supabaseServer();
  const { data: session } = await supabase
    .from("consultant_sessions")
    .select("id, project_id, structured_brief, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return null;

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", session.project_id)
    .maybeSingle();
  if (!project || project.user_id !== userId) return null;
  return session;
}

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const sessionId = new URL(req.url).searchParams.get("sessionId");
  const parsedId = z.string().uuid().safeParse(sessionId);
  if (!parsedId.success) return new NextResponse("Invalid session", { status: 400 });

  const session = await getOwnedSession(parsedId.data, user.id);
  if (!session) return new NextResponse("Not found", { status: 404 });

  const { data: messages } = await supabase
    .from("consultant_messages")
    .select("id, role, content, structured_data, created_at")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    brief: (session.structured_brief as PartialBrief | null) ?? {},
    status: session.status,
    messages: messages ?? [],
  });
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = postBodySchema.safeParse(raw);
  if (!parsed.success) return new NextResponse("Invalid body", { status: 400 });

  const session = await getOwnedSession(parsed.data.sessionId, user.id);
  if (!session) return new NextResponse("Not found", { status: 404 });

  const { data: existingMessages } = await supabase
    .from("consultant_messages")
    .select("role, content")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true })
    .limit(30);

  const history = (existingMessages ?? [])
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: String(message.content ?? ""),
    }));

  await supabase.from("consultant_messages").insert({
    session_id: session.id,
    role: "user",
    content: parsed.data.message,
    structured_data: { type: "conversation" },
  });

  try {
    const currentBrief =
      partialBriefSchema.safeParse(session.structured_brief).data ?? ({} as PartialBrief);
    const { data: turn, usage } = await aiProvider().continueConsultation({
      knownBrief: currentBrief,
      history,
      userMessage: parsed.data.message,
    });
    const updatedBrief = mergeBrief(currentBrief, turn.brief_patch);

    await supabase.from("consultant_messages").insert({
      session_id: session.id,
      role: "assistant",
      content: turn.message,
      structured_data: {
        type: "consultant_turn",
        recommendation: turn.recommendation,
        choices: turn.choices,
        ready_to_generate: turn.ready_to_generate,
        model: usage.model,
        request_id: usage.request_id,
      },
    });

    await supabase
      .from("consultant_sessions")
      .update({
        current_step: "conversation",
        status: turn.ready_to_generate ? "ready" : "active",
        structured_brief: updatedBrief,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    return NextResponse.json({ turn, brief: updatedBrief });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Consultant failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
