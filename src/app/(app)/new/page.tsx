"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/browser";

const OPTIONS: { code: string; label: string; hint: string }[] = [
  { code: "social_post", label: "Social post", hint: "IG, FB, TikTok, LinkedIn" },
  { code: "ad_copy", label: "Ad copy", hint: "Paid media caption" },
  { code: "product_promo", label: "Product promo", hint: "Feature a specific product" },
  { code: "service_promo", label: "Service promo", hint: "Book a service" },
  { code: "event_promo", label: "Event promo", hint: "Launch or event" },
  { code: "brand_content", label: "Brand content", hint: "Values, story" },
  { code: "other", label: "Something else", hint: "You'll describe it next" },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) {
      router.push("/login");
      return;
    }
    const { data: project, error: pErr } = await supabase
      .from("projects")
      .insert({ user_id: user.id, title: "New project", content_type: selected })
      .select("id")
      .single();
    if (pErr || !project) {
      setError(pErr?.message || "Could not create project");
      setLoading(false);
      return;
    }
    const { data: session, error: sErr } = await supabase
      .from("consultant_sessions")
      .insert({
        project_id: project.id,
        user_id: user.id,
        current_step: "product",
        structured_brief: { content_type: selected },
      })
      .select("id")
      .single();
    if (sErr || !session) {
      setError(sErr?.message || "Could not start consultant session");
      setLoading(false);
      return;
    }
    router.push(`/projects/${project.id}/consultant/${session.id}`);
  }

  return (
    <main className="flex flex-col gap-6 px-6 pb-6 pt-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">What are we making today?</h1>
        <p className="mt-1 text-sm text-neutral-500">Pick the closest match. You can refine later.</p>
      </header>

      <ul role="radiogroup" aria-label="Content type" className="space-y-2">
        {OPTIONS.map((o) => (
          <li key={o.code}>
            <button
              type="button"
              role="radio"
              aria-checked={selected === o.code}
              onClick={() => setSelected(o.code)}
              className={
                "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left " +
                (selected === o.code
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-900")
              }
            >
              <span>
                <span className="block font-medium">{o.label}</span>
                <span
                  className={
                    "block text-xs " + (selected === o.code ? "text-neutral-300" : "text-neutral-500")
                  }
                >
                  {o.hint}
                </span>
              </span>
              <span aria-hidden>›</span>
            </button>
          </li>
        ))}
      </ul>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <Button size="block" disabled={!selected} loading={loading} onClick={start}>
        Continue
      </Button>
    </main>
  );
}
