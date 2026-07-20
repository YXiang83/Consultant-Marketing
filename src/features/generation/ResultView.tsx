"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { GeneratedCopy, GeneratedImage, RevisionKind } from "@/lib/ai/types";

export function ResultView({
  projectId,
  copy,
  image,
}: {
  projectId: string;
  copy: GeneratedCopy;
  image: GeneratedImage | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"copy" | "image" | "strategy" | "revise">("copy");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateImage() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate image");
    } finally {
      setBusy(false);
    }
  }

  async function revise(kind: RevisionKind) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/revise", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, kind }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revise");
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text: string) {
    if (typeof navigator === "undefined") return;
    await navigator.clipboard.writeText(text);
  }

  const imgSrc =
    image?.base64 ? `data:image/png;base64,${image.base64}` : image?.url ?? null;

  return (
    <div>
      <div role="tablist" className="mb-4 flex gap-2 overflow-x-auto">
        {(["copy", "image", "strategy", "revise"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={
              "rounded-full border px-3 py-1.5 text-sm capitalize " +
              (tab === t ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {tab === "copy" && (
        <div className="space-y-3">
          <Card>
            <CardTitle>Headline</CardTitle>
            <p className="mt-2 text-lg font-semibold leading-snug">{copy.headline}</p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => copyText(copy.headline)}>
                Copy
              </Button>
            </div>
          </Card>
          <Card>
            <CardTitle>Hook</CardTitle>
            <p className="mt-2">{copy.hook}</p>
          </Card>
          <Card>
            <CardTitle>Body</CardTitle>
            <p className="mt-2 whitespace-pre-wrap">{copy.body}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => copyText(copy.body)}>
                Copy body
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  copyText(
                    `${copy.headline}\n\n${copy.body}\n\n${copy.cta}${copy.hashtags.length ? "\n\n" + copy.hashtags.map((h) => `#${h}`).join(" ") : ""}`,
                  )
                }
              >
                Copy all
              </Button>
            </div>
          </Card>
          <Card>
            <CardTitle>Short version</CardTitle>
            <p className="mt-2">{copy.short_version}</p>
          </Card>
          <Card>
            <CardTitle>CTA</CardTitle>
            <p className="mt-2 font-medium">{copy.cta}</p>
          </Card>
          {copy.hashtags.length > 0 && (
            <Card>
              <CardTitle>Hashtags</CardTitle>
              <p className="mt-2 text-neutral-700">{copy.hashtags.map((h) => `#${h}`).join(" ")}</p>
            </Card>
          )}
          {copy.platform_variants.length > 0 && (
            <Card>
              <CardTitle>Per platform</CardTitle>
              <ul className="mt-2 space-y-3">
                {copy.platform_variants.map((v) => (
                  <li key={v.platform}>
                    <p className="text-xs uppercase tracking-wide text-neutral-500">{v.platform}</p>
                    <p className="mt-1 whitespace-pre-wrap">{v.content}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === "image" && (
        <div className="space-y-3">
          {imgSrc ? (
            <Card>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgSrc} alt="Generated marketing image" className="w-full rounded-xl" />
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => imgSrc && window.open(imgSrc, "_blank")}>
                  Open full
                </Button>
                <Button variant="outline" size="sm" onClick={() => revise("regenerate")} loading={busy}>
                  Regenerate
                </Button>
              </div>
            </Card>
          ) : (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
              No image yet.
              <div className="mt-3">
                <Button onClick={generateImage} loading={busy}>
                  Generate an image
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "strategy" && (
        <Card>
          <CardTitle>Publishing tips</CardTitle>
          <p className="mt-2 text-sm text-neutral-600">
            Detailed publishing guidance is generated with your content. Regenerate the strategy from the Revise tab
            when you change the brief.
          </p>
        </Card>
      )}

      {tab === "revise" && (
        <div className="space-y-2">
          {(
            [
              ["shorter", "Make it shorter"],
              ["longer", "Make it longer"],
              ["different_tone", "Change tone"],
              ["different_platform", "Adapt for another platform"],
              ["different_audience", "Speak to a different audience"],
              ["regenerate", "Regenerate from scratch"],
            ] as const
          ).map(([kind, label]) => (
            <Button
              key={kind}
              variant="outline"
              size="block"
              onClick={() => revise(kind)}
              loading={busy}
            >
              {label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
