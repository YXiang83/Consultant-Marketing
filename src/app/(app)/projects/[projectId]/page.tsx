import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { ResultView } from "@/features/generation/ResultView";
import type { GeneratedCopy, GeneratedImage } from "@/lib/ai/types";

export type ResultImage = GeneratedImage & { assetId: string };

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await supabaseServer();
  const { data: project } = await supabase
    .from("projects")
    .select("id, title, content_type, platform, status")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  const { data: assets } = await supabase
    .from("generated_assets")
    .select("id, asset_type, version, content, storage_path, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const copyAsset = assets?.find((asset) => asset.asset_type === "copy");
  const copy = (copyAsset?.content as GeneratedCopy | undefined) ?? null;
  const images: ResultImage[] = (assets ?? [])
    .filter((asset) => asset.asset_type === "image")
    .map((asset) => ({
      ...((asset.content as GeneratedImage | undefined) ?? {
        base64: null,
        url: null,
        model: "unknown",
        prompt: "",
        direction_id: "",
        direction_title: "",
      }),
      assetId: asset.id,
    }));

  return (
    <main className="flex flex-col gap-5 px-5 pb-6 pt-7 sm:px-6">
      <header>
        <p className="text-xs text-neutral-500">{project.content_type}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
      </header>

      {!copy ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
          还没有生成内容。
          <div className="mt-3">
            <Link href="/new" className="underline">
              开始顾问对话
            </Link>
          </div>
        </div>
      ) : (
        <ResultView projectId={project.id} copy={copy} images={images} />
      )}
    </main>
  );
}
