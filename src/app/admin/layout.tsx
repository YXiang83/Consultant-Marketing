import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/membership";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/home");

  return (
    <div className="min-h-full bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Administrator</p>
            <p className="font-semibold">Consultant Marketing</p>
          </div>
          <Link href="/home" className="text-sm text-neutral-600 underline">
            Back to app
          </Link>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-5 pb-3 text-sm">
          <Link href="/admin/members" className="rounded-full border border-neutral-300 bg-white px-4 py-2">
            Members
          </Link>
          <Link href="/admin/plans" className="rounded-full border border-neutral-300 bg-white px-4 py-2">
            Plans
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-6">{children}</main>
    </div>
  );
}
