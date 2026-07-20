"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NextQuestion, PartialBrief } from "@/lib/ai/types";

export default function ConsultantFlowPage() {
  const params = useParams<{ projectId: string; sessionId: string }>();
  const router = useRouter();
  const [question, setQuestion] = useState<NextQuestion | null>(null);
  const [brief, setBrief] = useState<PartialBrief>({});
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textValue, setTextValue] = useState("");
  const [choiceValue, setChoiceValue] = useState<string | null>(null);
  const [multiValue, setMultiValue] = useState<string[]>([]);

  useEffect(() => {
    void loadNext(brief);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadNext(currentBrief: PartialBrief) {
    setLoading(true);
    setError(null);
    setTextValue("");
    setChoiceValue(null);
    setMultiValue([]);
    try {
      const res = await fetch("/api/consultant/next-question", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: params.sessionId, brief: currentBrief }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { question: NextQuestion; brief: PartialBrief };
      setBrief(data.brief);
      setQuestion(data.question);
      if (data.question.recommended_option) setChoiceValue(data.question.recommended_option);
      if (data.question.is_complete) {
        router.push(`/projects/${params.projectId}/brief/${params.sessionId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "发生了一点问题，请再试一次。");
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer() {
    if (!question) return;
    let value: string | string[] = "";
    if (question.input_type === "text" || question.input_type === "long_text") value = textValue.trim();
    else if (question.input_type === "single_choice") value = choiceValue || "";
    else value = multiValue;

    if ((typeof value === "string" && !value) || (Array.isArray(value) && value.length === 0)) {
      setError("先选一个方向，或写一点资料再继续。");
      return;
    }

    setAnswering(true);
    setError(null);
    try {
      const res = await fetch("/api/consultant/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: params.sessionId, step: question.step, answer: value }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { brief: PartialBrief };
      await loadNext(data.brief);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法保存，请再试一次。");
    } finally {
      setAnswering(false);
    }
  }

  if (loading) {
    return (
      <main className="flex flex-col items-center justify-center gap-3 px-6 pt-16">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
        <p className="text-sm text-neutral-500">顾问正在判断最适合的方向…</p>
      </main>
    );
  }

  if (!question) {
    return (
      <main className="px-6 pt-8">
        <p className="text-sm text-red-700">{error || "暂时无法载入顾问。"}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 pb-8 pt-6">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Marketing consultant</p>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">{question.question}</h1>
        {question.helper && <p className="text-sm leading-6 text-neutral-600">{question.helper}</p>}
      </header>

      {question.recommended_option && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">我的建议</p>
          <p className="mt-1 text-base font-semibold text-emerald-950">{question.recommended_option}</p>
          {question.recommendation_reason && (
            <p className="mt-1 text-sm leading-6 text-emerald-900">{question.recommendation_reason}</p>
          )}
        </section>
      )}

      {(question.input_type === "text" || question.input_type === "long_text") && (
        <div className="space-y-2">
          <Label htmlFor="answer">随便说，不需要整理</Label>
          {question.input_type === "long_text" ? (
            <Textarea
              id="answer"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              rows={7}
              placeholder="例如：我在新山卖靠近 CIQ 的公寓，六十多万，想吸引在新加坡工作的人…"
            />
          ) : (
            <Input id="answer" value={textValue} onChange={(e) => setTextValue(e.target.value)} />
          )}
        </div>
      )}

      {question.input_type === "single_choice" && (
        <ul role="radiogroup" className="space-y-3">
          {question.options.map((opt) => {
            const selected = choiceValue === opt;
            const recommended = question.recommended_option === opt;
            return (
              <li key={opt}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setChoiceValue(opt)}
                  className={
                    "flex w-full items-start justify-between gap-4 rounded-2xl border px-4 py-4 text-left transition " +
                    (selected
                      ? "border-neutral-950 bg-neutral-950 text-white"
                      : "border-neutral-200 bg-white text-neutral-950 hover:border-neutral-400")
                  }
                >
                  <span className="font-medium">{opt}</span>
                  {recommended && (
                    <span className={"shrink-0 rounded-full px-2 py-1 text-xs " + (selected ? "bg-white/15" : "bg-emerald-100 text-emerald-800")}>
                      推荐
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {question.input_type === "multi_choice" && (
        <ul role="group" className="flex flex-wrap gap-2">
          {question.options.map((opt) => {
            const checked = multiValue.includes(opt);
            return (
              <li key={opt}>
                <button
                  type="button"
                  aria-pressed={checked}
                  onClick={() => setMultiValue((prev) => (prev.includes(opt) ? prev.filter((p) => p !== opt) : [...prev, opt]))}
                  className={
                    "rounded-full border px-4 py-2 text-sm " +
                    (checked ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-900")
                  }
                >
                  {opt}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <Button size="block" loading={answering} onClick={submitAnswer}>
        {question.recommended_option && choiceValue === question.recommended_option ? "采用这个建议" : "继续"}
      </Button>
    </main>
  );
}
