import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";

export default async function HomePage() {
  const supabase = await supabaseServer();
  const [{ data: userRes }, { data: member }, { data: balance }, { data: projects }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("members").select("display_name").maybeSingle(),
    supabase
      .from("usage_balances")
      .select("copy_used, copy_limit, image_used, image_limit, period_end")
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("projects")
      .select("id, title, status, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const name = member?.display_name || userRes.user?.email?.split("@")[0] || "there";
  const copyRemaining = balance ? balance.copy_limit - balance.copy_used : 0;
  const imageRemaining = balance ? balance.image_limit - balance.image_used : 0;

  return (
    <main className="flex flex-col gap-6 px-6 pb-6 pt-8">
      <header>
        <p className="text-sm text-neutral-500">Welcome back</p>
        <h1 className="text-2xl font-semibold tracking-tight">Hi {name}</h1>
      </header>

      <section aria-label="Your plan" className="grid grid-cols-2 gap-3">
        <Card>
          <CardDescription>Copy left this month</CardDescription>
          <CardTitle className="mt-1 text-2xl">{copyRemaining}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Images left this month</CardDescription>
          <CardTitle className="mt-1 text-2xl">{imageRemaining}</CardTitle>
        </Card>
      </section>

      <Link href="/new" className="block">
        <Button size="block">
          <PlusCircle className="mr-2 h-5 w-5" />
          Start a new project
        </Button>
      </Link>

      <section aria-label="Recent projects">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-700">Recent</h2>
          <Link href="/projects" className="text-sm text-neutral-500 underline">
            See all
          </Link>
        </div>
        {projects && projects.length > 0 ? (
          <ul className="space-y-2">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3"
                >
                  <span className="truncate">{p.title}</span>
                  <span className="text-xs text-neutral-500 capitalize">{p.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">No projects yet. Start your first one above.</p>
        )}
      </section>
    </main>
  );
}
