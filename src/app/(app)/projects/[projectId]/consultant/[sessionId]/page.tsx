"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import type { ConsultantChoice, ConsultantTurn, PartialBrief } from "@/lib/ai/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  structured_data?: {
    recommendation?: string;
    choices?: ConsultantChoice[];
    ready_to_generate?: boolean;
  } | null;
};

const welcomeMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "告诉我你今天想推广什么。像发 WhatsApp 一样随便讲：卖什么、在哪里、价格、顾客是谁，知道多少就说多少。你不需要写 Prompt。",
};

export default function ConsultantFlowPage() {
  const params = useParams<{ projectId: string; sessionId: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [brief, setBrief] = useState<PartialBrief>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadConversation() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/consultant/chat?sessionId=${encodeURIComponent(params.sessionId)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { messages: ChatMessage[]; brief: PartialBrief };
      setMessages(data.messages ?? []);
      setBrief(data.brief ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法加载对话");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(text: string) {
    const value = text.trim();
    if (!value || sending) return;

    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: value,
    };
    setMessages((current) => [...current, optimistic]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/consultant/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: params.sessionId, message: value }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { turn: ConsultantTurn; brief: PartialBrief; error?: never }
        | { error: string; turn?: never; brief?: never }
        | null;
      if (!res.ok || !payload || !payload.turn) {
        throw new Error(payload?.error || "顾问暂时无法回复");
      }

      setBrief(payload.brief);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: payload.turn.message,
          structured_data: {
            recommendation: payload.turn.recommendation,
            choices: payload.turn.choices,
            ready_to_generate: payload.turn.ready_to_generate,
          },
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setSending(false);
    }
  }

  const visibleMessages = messages.length > 0 ? messages : [welcomeMessage];
  const latestAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant") ?? null,
    [messages],
  );
  const choices = latestAssistant?.structured_data?.choices ?? [];
  const recommendation = latestAssistant?.structured_data?.recommendation ?? "";
  const ready = Boolean(latestAssistant?.structured_data?.ready_to_generate);

  if (loading) {
    return (
      <main className="flex flex-col items-center justify-center gap-3 px-6 pt-20">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
        <p className="text-sm text-neutral-500">正在打开顾问对话…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-5rem)] flex-col px-4 pb-5 pt-5 sm:px-6">
      <header className="mb-5">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Marketing consultant</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">直接跟顾问说</h1>
        <p className="mt-1 text-sm text-neutral-500">顾问负责判断策略。你只需要说明生意情况和修改意见。</p>
      </header>

      <section className="flex-1 space-y-4" aria-live="polite">
        {visibleMessages.map((message) => (
          <div
            key={message.id}
            className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                "max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 " +
                (message.role === "user"
                  ? "rounded-br-md bg-neutral-900 text-white"
                  : "rounded-bl-md border border-neutral-200 bg-white text-neutral-900")
              }
            >
              {message.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500">
              顾问正在分析，而不是套模板…
            </div>
          </div>
        )}
      </section>

      {recommendation && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">顾问建议</p>
          <p className="mt-1 text-sm leading-6 text-emerald-950">{recommendation}</p>
        </div>
      )}

      {choices.length > 0 && !sending && (
        <div className="mt-3 grid gap-2">
          {choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() =>
                void sendMessage(
                  `我选择「${choice.label}」。${choice.description ? `我的理解是：${choice.description}` : ""}`,
                )
              }
              className={
                "rounded-2xl border px-4 py-3 text-left transition " +
                (choice.recommended
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white hover:border-neutral-400")
              }
            >
              <span className="flex items-center justify-between gap-3">
                <strong className="text-sm">{choice.label}</strong>
                {choice.recommended && <span className="text-xs text-neutral-300">推荐</span>}
              </span>
              {choice.description && (
                <span className={"mt-1 block text-xs leading-5 " + (choice.recommended ? "text-neutral-300" : "text-neutral-500")}>
                  {choice.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {ready && (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-sm font-semibold">顾问已经有足够资料</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            {brief.copy_mode === "content" ? "接下来生成三种内容型方向。" : "接下来生成三种销售型方向。"}
          </p>
          <Button
            size="block"
            className="mt-3"
            onClick={() => router.push(`/projects/${params.projectId}/brief/${params.sessionId}`)}
          >
            查看策略并生成 3 个文案方案
          </Button>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="sticky bottom-0 mt-5 border-t border-neutral-200 bg-neutral-50/95 pt-4 backdrop-blur">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendMessage(input);
            }
          }}
          rows={3}
          placeholder="继续说，或直接讲你想怎么改…"
          disabled={sending}
        />
        <Button size="block" className="mt-2" loading={sending} onClick={() => void sendMessage(input)}>
          发送给顾问
        </Button>
      </div>
    </main>
  );
}
