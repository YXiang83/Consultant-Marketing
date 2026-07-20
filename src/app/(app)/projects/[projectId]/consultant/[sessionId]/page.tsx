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
      if (data.question.is_complete) {
        router.push(`/projects/${params.projectId}/brief/${params.sessionId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
      setError("Please give an answer to continue.");
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
      setError(err instanceof Error ? err.message : "Could not save your answer");
    } finally {
      setAnswering(false);
    }
  }

  if (loading) {
    return (
      <main className="flex flex-col items-center justify-center gap-3 px-6 pt-16">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
        <p className="text-sm text-neutral-500">Thinking of the next question…</p>
      </main>
    );
  }

  if (!question) {
    return (
      <main className="px-6 pt-8">
        <p className="text-sm text-red-700">{error || "No question loaded."}</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6 px-6 pb-6 pt-8">
      <header>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Step · {question.step}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{question.question}</h1>
        {question.helper && <p className="mt-1 text-sm text-neutral-500">{question.helper}</p>}
      </header>

      {(question.input_type === "text" || question.input_type === "long_text") && (
        <div>
          <Label htmlFor="answer">Your answer</Label>
          {question.input_type === "long_text" ? (
            <Textarea id="answer" value={textValue} onChange={(e) => setTextValue(e.target.value)} rows={5} />
          ) : (
            <Input id="answer" value={textValue} onChange={(e) => setTextValue(e.target.value)} />
          )}
        </div>
      )}

      {question.input_type === "single_choice" && (
        <ul role="radiogroup" className="space-y-2">
          {question.options.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                role="radio"
                aria-checked={choiceValue === opt}
                onClick={() => setChoiceValue(opt)}
                className={
                  "flex w-full items-center rounded-xl border px-4 py-3 text-left " +
                  (choiceValue === opt
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white")
                }
              >
                {opt}
              </button>
            </li>
          ))}
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
                  onClick={() =>
                    setMultiValue((prev) => (prev.includes(opt) ? prev.filter((p) => p !== opt) : [...prev, opt]))
                  }
                  className={
                    "rounded-full border px-4 py-2 text-sm " +
                    (checked
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-900")
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
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <Button size="block" loading={answering} onClick={submitAnswer}>
        Next
      </Button>
    </main>
  );
}
