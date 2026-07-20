import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { supabaseServer } from "@/lib/supabase/server";
import { publicEnvSafe } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const env = publicEnvSafe();
  if (env) {
    try {
      const supabase = await supabaseServer();
      const { data } = await supabase.auth.getUser();
      if (data.user) redirect("/home");
    } catch {
      // fall through to marketing landing
    }
  }

  return (
    <main className="flex flex-1 flex-col justify-between px-6 py-10">
      <div>
        <div className="mb-6 inline-flex rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
          Mobile marketing consultant
        </div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">
          Your pocket marketing consultant.
        </h1>
        <p className="mt-3 text-neutral-600">
          Answer a few simple questions. Get ready-to-publish copy, images, and a plan — without
          learning any prompts.
        </p>

        <ul className="mt-8 space-y-3 text-sm text-neutral-700">
          <li className="flex items-start gap-3">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-900" />
            Guided conversation, one question at a time
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-900" />
            Platform-specific versions (Instagram, TikTok, LinkedIn…)
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-900" />
            AI images that match your copy and brand
          </li>
        </ul>
      </div>

      <div className="mt-10 space-y-3">
        <Link href="/register" className="block">
          <Button size="block">Get started</Button>
        </Link>
        <Link href="/login" className="block">
          <Button size="block" variant="outline">
            I already have an account
          </Button>
        </Link>
        <p className="text-center text-xs text-neutral-500">
          By continuing you agree to our terms and privacy policy.
        </p>
      </div>
    </main>
  );
}
