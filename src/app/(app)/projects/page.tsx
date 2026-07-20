import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

export default async function ProjectsPage() {
  const supabase = await supabaseServer();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, status, content_type, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <main className="flex flex-col gap-4 px-6 pb-6 pt-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
      </header>
      {projects && projects.length > 0 ? (
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3"
              >
                <span>
                  <span className="block truncate font-medium">{p.title}</span>
                  <span className="block text-xs text-neutral-500">{p.content_type}</span>
                </span>
                <span className="text-xs capitalize text-neutral-500">{p.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500">
          No projects yet.{" "}
          <Link href="/new" className="underline">
            Start your first
          </Link>
          .
        </p>
      )}
    </main>
  );
}
