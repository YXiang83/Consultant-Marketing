"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MarketingBrief } from "@/lib/ai/types";

export default function BriefConfirmationPage() {
  const params = useParams<{ projectId: string; sessionId: string }>();
  const router = useRouter();
  const [brief, setBrief] = useState<MarketingBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/consultant/normalize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: params.sessionId }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { brief: MarketingBrief };
        setBrief(data.brief);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load brief");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.sessionId]);

  async function generate() {
    if (!brief) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/copy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: params.projectId, brief }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.push(`/projects/${params.projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate");
    } finally {
      setGenerating(false);
    }
  }

  if (loading || !brief) {
    return (
      <main className="flex flex-col items-center justify-center gap-3 px-6 pt-16">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
        <p className="text-sm text-neutral-500">Building your brief…</p>
      </main>
    );
  }

  const set = <K extends keyof MarketingBrief>(k: K, v: MarketingBrief[K]) => setBrief({ ...brief, [k]: v });
  const setAudience = (patch: Partial<MarketingBrief["audience"]>) =>
    setBrief({ ...brief, audience: { ...brief.audience, ...patch } });

  return (
    <main className="flex flex-col gap-5 px-6 pb-6 pt-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Check the brief</h1>
        <p className="mt-1 text-sm text-neutral-500">Edit anything before we generate.</p>
      </header>

      <div>
        <Label htmlFor="product">Product or service</Label>
        <Input id="product" value={brief.product_or_service} onChange={(e) => set("product_or_service", e.target.value)} />
      </div>
      <div>
        <Label htmlFor="desc">Short description</Label>
        <Textarea id="desc" value={brief.short_description} onChange={(e) => set("short_description", e.target.value)} />
      </div>
      <div>
        <Label htmlFor="goal">Goal</Label>
        <Input id="goal" value={brief.goal} onChange={(e) => set("goal", e.target.value)} />
      </div>
      <div>
        <Label htmlFor="who">Who is it for</Label>
        <Textarea id="who" value={brief.audience.who} onChange={(e) => setAudience({ who: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="pains">Their pain points</Label>
        <Textarea
          id="pains"
          value={brief.audience.pain_points}
          onChange={(e) => setAudience({ pain_points: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="platforms">Platforms (comma-separated)</Label>
        <Input
          id="platforms"
          value={brief.platforms.join(", ")}
          onChange={(e) =>
            set(
              "platforms",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="tone">Tone</Label>
          <Input id="tone" value={brief.tone} onChange={(e) => set("tone", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cta">Call to action</Label>
          <Input id="cta" value={brief.cta} onChange={(e) => set("cta", e.target.value)} />
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <Button size="block" loading={generating} onClick={generate}>
        Generate my content
      </Button>
    </main>
  );
}
