import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderClosed, Home, ShieldCheck, User } from "lucide-react";
import { publicEnvSafe } from "@/lib/env";
import { getStrictMembershipAccess } from "@/lib/membership-access";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!publicEnvSafe()) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <p className="text-lg font-semibold">Environment not configured</p>
        <p className="text-sm text-neutral-600">
          Missing Supabase env vars. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
        </p>
      </main>
    );
  }

  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const access = await getStrictMembershipAccess(data.user);
  if (!access.allowed) redirect("/membership-status");

  const columns = access.isAdmin ? "grid-cols-4" : "grid-cols-3";

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 pb-20">{children}</div>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-neutral-200 bg-white/95 backdrop-blur"
      >
        <ul className={`grid ${columns}`}>
          <NavItem href="/home" label="Home" icon={<Home className="h-5 w-5" />} />
          <NavItem href="/projects" label="Projects" icon={<FolderClosed className="h-5 w-5" />} />
          {access.isAdmin && <NavItem href="/admin/members" label="Admin" icon={<ShieldCheck className="h-5 w-5" />} />}
          <NavItem href="/account" label="Account" icon={<User className="h-5 w-5" />} />
        </ul>
      </nav>
    </div>
  );
}

function NavItem({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="flex flex-col items-center gap-1 py-3 text-xs text-neutral-600 hover:text-neutral-900"
      >
        {icon}
        <span>{label}</span>
      </Link>
    </li>
  );
}
