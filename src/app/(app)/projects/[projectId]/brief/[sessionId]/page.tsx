"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { MarketingBrief } from "@/lib/ai/types";

export default function BriefConfirmationPage() {
  const params = useParams<{ projectId: string; sessionId: string }>();
  const router = useRouter();
  const [brief, setBrief] = useState<MarketingBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadBrief();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBrief() {
    try {
      const res = await fetch("/api/consultant/normalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: params.sessionId }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { brief: MarketingBrief; error?: never }
        | { error: string; brief?: never }
        | null;
      if (!res.ok || !payload?.brief) throw new Error(payload?.error || "无法整理策略");
      setBrief(payload.brief);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法整理策略");
    } finally {
      setLoading(false);
    }
  }

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
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error || "文案生成失败");
      router.push(`/projects/${params.projectId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "文案生成失败");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <main className="flex flex-col items-center justify-center gap-3 px-6 pt-20">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
        <p className="text-sm text-neutral-500">顾问正在整理策略…</p>
      </main>
    );
  }

  if (!brief) {
    return (
      <main className="px-6 pt-8">
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error || "没有可用的策略资料。"}
        </div>
        <Button className="mt-4" variant="outline" onClick={() => router.back()}>
          回到顾问对话
        </Button>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 px-5 pb-6 pt-7 sm:px-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Consultant decision</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">顾问建议这样做</h1>
        <p className="mt-1 text-sm text-neutral-500">没有问卷。这里只确认 AI 从对话中整理出的策略。</p>
      </header>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">文案类型</p>
            <p className="mt-1 text-xl font-semibold">{brief.copy_mode === "content" ? "内容型" : "销售型"}</p>
          </div>
          <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white">AI 推荐</span>
        </div>
        {brief.consultant_summary && <p className="mt-3 text-sm leading-6 text-neutral-700">{brief.consultant_summary}</p>}
      </Card>

      <Card>
        <CardTitle>主方向</CardTitle>
        <p className="mt-2 text-lg font-semibold leading-snug">{brief.selected_angle || "从顾客最实际的问题切入"}</p>
      </Card>

      <Card>
        <CardTitle>顾问理解的生意</CardTitle>
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="text-xs text-neutral-500">产品或服务</dt>
            <dd className="mt-1 font-medium">{brief.product_or_service}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">主要顾客</dt>
            <dd className="mt-1">{brief.audience.who || "由顾问按产品判断"}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">希望顾客做什么</dt>
            <dd className="mt-1">{brief.cta || brief.goal}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">发布平台</dt>
            <dd className="mt-1">{brief.platforms.length ? brief.platforms.join("、") : "由顾问选择最合适的平台"}</dd>
          </div>
        </dl>
      </Card>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <Button size="block" loading={generating} onClick={generate}>
        生成 3 个真正不同的文案方案
      </Button>
      <Button
        size="block"
        variant="outline"
        onClick={() => router.push(`/projects/${params.projectId}/consultant/${params.sessionId}`)}
      >
        回到对话修改策略
      </Button>
    </main>
  );
}
