"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import type {
  GeneratedCopy,
  GeneratedCopyVariant,
  GeneratedImage,
  RevisionKind,
} from "@/lib/ai/types";

type ResultImage = GeneratedImage & { assetId: string };

function imageSource(image: GeneratedImage | null) {
  if (!image) return null;
  if (image.base64) return `data:image/png;base64,${image.base64}`;
  return image.url;
}

export function ResultView({
  projectId,
  copy,
  images,
}: {
  projectId: string;
  copy: GeneratedCopy;
  images: ResultImage[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"copy" | "image" | "strategy" | "revise">("copy");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageCount, setImageCount] = useState<2 | 3 | 4>(4);
  const [aspect, setAspect] = useState<"1:1" | "4:5" | "16:9" | "9:16">("4:5");
  const [copyInstruction, setCopyInstruction] = useState("");
  const [imageInstruction, setImageInstruction] = useState("");
  const [selectedImageId, setSelectedImageId] = useState<string | null>(images[0]?.assetId ?? null);

  const fallbackVariant: GeneratedCopyVariant = {
    id: "legacy",
    title: "推荐文案",
    angle: "原始生成方向",
    why_it_works: copy.recommendation_reason || "根据顾问整理的 Brief 生成。",
    headline: copy.headline,
    hook: copy.hook,
    body: copy.body,
    short_version: copy.short_version,
    cta: copy.cta,
    hashtags: copy.hashtags,
    platform_variants: copy.platform_variants,
  };
  const variants = copy.variants?.length ? copy.variants : [fallbackVariant];
  const initialVariant =
    variants.find((variant) => variant.id === copy.recommended_variant_id)?.id ?? variants[0].id;
  const [selectedVariantId, setSelectedVariantId] = useState(initialVariant);
  const selectedVariant =
    variants.find((variant) => variant.id === selectedVariantId) ?? variants[0];
  const selectedImage = useMemo(
    () => images.find((image) => image.assetId === selectedImageId) ?? images[0] ?? null,
    [images, selectedImageId],
  );

  async function generateImages() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, count: imageCount, aspect }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error || "图片生成失败");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片生成失败");
    } finally {
      setBusy(false);
    }
  }

  async function editSelectedImage() {
    if (!selectedImage || !imageInstruction.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/image/edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          imageAssetId: selectedImage.assetId,
          instruction: imageInstruction.trim(),
          aspect,
        }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error || "图片修改失败");
      setImageInstruction("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片修改失败");
    } finally {
      setBusy(false);
    }
  }

  async function revise(kind: RevisionKind, instruction?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/revise", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, kind, instruction }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error || "文案修改失败");
      setCopyInstruction("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "文案修改失败");
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text: string) {
    if (typeof navigator === "undefined") return;
    await navigator.clipboard.writeText(text);
  }

  const selectedImageSrc = imageSource(selectedImage);

  return (
    <div>
      <div role="tablist" className="mb-4 flex gap-2 overflow-x-auto">
        {(
          [
            ["copy", "文案"],
            ["image", "图片"],
            ["strategy", "顾问判断"],
            ["revise", "修改文案"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={
              "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm " +
              (tab === value ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white")
            }
          >
            {label}
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
          <div className="grid gap-2">
            {variants.map((variant) => {
              const selected = variant.id === selectedVariant.id;
              const recommended = variant.id === copy.recommended_variant_id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setSelectedVariantId(variant.id)}
                  className={
                    "rounded-2xl border px-4 py-3 text-left " +
                    (selected ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white")
                  }
                >
                  <span className="flex items-center justify-between gap-3">
                    <strong className="text-sm">{variant.title}</strong>
                    {recommended && <span className="text-xs opacity-70">顾问推荐</span>}
                  </span>
                  <span className={"mt-1 block text-xs leading-5 " + (selected ? "text-neutral-300" : "text-neutral-500")}>
                    {variant.angle}
                  </span>
                </button>
              );
            })}
          </div>

          <Card>
            <CardTitle>为什么这个方向有效</CardTitle>
            <p className="mt-2 text-sm leading-6 text-neutral-700">{selectedVariant.why_it_works}</p>
          </Card>
          <Card>
            <CardTitle>标题</CardTitle>
            <p className="mt-2 text-xl font-semibold leading-snug">{selectedVariant.headline}</p>
          </Card>
          <Card>
            <CardTitle>开头</CardTitle>
            <p className="mt-2 leading-7">{selectedVariant.hook}</p>
          </Card>
          <Card>
            <CardTitle>完整文案</CardTitle>
            <p className="mt-2 whitespace-pre-wrap leading-7">{selectedVariant.body}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void copyText(selectedVariant.body)}>
                复制正文
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void copyText(
                    `${selectedVariant.headline}\n\n${selectedVariant.body}\n\n${selectedVariant.cta}${
                      selectedVariant.hashtags.length
                        ? `\n\n${selectedVariant.hashtags.map((tag) => `#${tag}`).join(" ")}`
                        : ""
                    }`,
                  )
                }
              >
                复制全部
              </Button>
            </div>
          </Card>
          <Card>
            <CardTitle>短版</CardTitle>
            <p className="mt-2 leading-7">{selectedVariant.short_version}</p>
          </Card>
          {selectedVariant.platform_variants.length > 0 && (
            <Card>
              <CardTitle>各平台版本</CardTitle>
              <ul className="mt-3 space-y-4">
                {selectedVariant.platform_variants.map((variant) => (
                  <li key={variant.platform}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{variant.platform}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{variant.content}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === "image" && (
        <div className="space-y-4">
          {images.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {images.map((image) => {
                const src = imageSource(image);
                const selected = selectedImage?.assetId === image.assetId;
                return (
                  <button
                    key={image.assetId}
                    type="button"
                    onClick={() => setSelectedImageId(image.assetId)}
                    className={
                      "overflow-hidden rounded-2xl border bg-white text-left " +
                      (selected ? "border-2 border-neutral-900" : "border-neutral-200")
                    }
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt={image.direction_title || "Generated marketing visual"} className="aspect-[4/5] w-full object-cover" />
                    ) : (
                      <div className="flex aspect-[4/5] items-center justify-center bg-neutral-100 px-3 text-center text-xs text-neutral-500">
                        Mock 模式不会产生真实图片
                      </div>
                    )}
                    <div className="p-3">
                      <p className="text-xs font-semibold">{image.direction_title || "视觉方案"}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardTitle>生成视觉方案</CardTitle>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                系统会先设计不同的营销作用，再分别生成图片，不会只换颜色或角度。
              </p>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-neutral-600">
              图片数量
              <select
                value={imageCount}
                onChange={(event) => setImageCount(Number(event.target.value) as 2 | 3 | 4)}
                className="mt-1 block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <option value={2}>2 张</option>
                <option value={3}>3 张</option>
                <option value={4}>4 张</option>
              </select>
            </label>
            <label className="text-xs font-medium text-neutral-600">
              尺寸
              <select
                value={aspect}
                onChange={(event) => setAspect(event.target.value as typeof aspect)}
                className="mt-1 block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <option value="4:5">贴文 4:5</option>
                <option value="1:1">方形 1:1</option>
                <option value="9:16">Story 9:16</option>
                <option value="16:9">横版 16:9</option>
              </select>
            </label>
          </div>

          <Button size="block" onClick={() => void generateImages()} loading={busy}>
            {images.length ? `再生成 ${imageCount} 个不同方向` : `生成 ${imageCount} 个不同图片方向`}
          </Button>

          {selectedImage && (
            <Card>
              <CardTitle>修改选中的图片</CardTitle>
              {selectedImageSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedImageSrc} alt="Selected visual" className="mt-3 w-full rounded-xl" />
              )}
              <Textarea
                className="mt-3"
                rows={4}
                value={imageInstruction}
                onChange={(event) => setImageInstruction(event.target.value)}
                placeholder="例如：保留构图，把背景换成新山傍晚；人物换成亚洲上班族；左边留空间放标题。"
              />
              <Button
                size="block"
                className="mt-2"
                loading={busy}
                onClick={() => void editSelectedImage()}
              >
                按我的要求修改这张图
              </Button>
            </Card>
          )}
        </div>
      )}

      {tab === "strategy" && (
        <div className="space-y-3">
          <Card>
            <CardTitle>{copy.copy_mode === "content" ? "内容型" : "销售型"}</CardTitle>
            <p className="mt-2 text-sm leading-6 text-neutral-700">{copy.recommendation_reason}</p>
          </Card>
          {variants.map((variant) => (
            <Card key={variant.id}>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{variant.title}</CardTitle>
                {variant.id === copy.recommended_variant_id && (
                  <span className="rounded-full bg-neutral-900 px-2 py-1 text-[10px] text-white">推荐</span>
                )}
              </div>
              <p className="mt-2 text-sm font-medium">{variant.angle}</p>
              <p className="mt-1 text-sm leading-6 text-neutral-600">{variant.why_it_works}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === "revise" && (
        <div className="space-y-3">
          <Card>
            <CardTitle>直接告诉顾问怎么改</CardTitle>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              例如：不要那么硬销、写得更像马来西亚华人、保留第二版开头、结尾改成 WhatsApp 询问。
            </p>
            <Textarea
              className="mt-3"
              rows={5}
              value={copyInstruction}
              onChange={(event) => setCopyInstruction(event.target.value)}
              placeholder="输入你的修改意见…"
            />
            <Button
              size="block"
              className="mt-2"
              loading={busy}
              onClick={() => void revise("regenerate", copyInstruction.trim())}
            >
              按我的意见修改
            </Button>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => void revise("shorter")} loading={busy}>
              更短
            </Button>
            <Button variant="outline" onClick={() => void revise("longer")} loading={busy}>
              更详细
            </Button>
            <Button variant="outline" onClick={() => void revise("different_tone", "写得更自然，不要像广告模板")} loading={busy}>
              更自然
            </Button>
            <Button variant="outline" onClick={() => void revise("regenerate")} loading={busy}>
              换一组方向
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
