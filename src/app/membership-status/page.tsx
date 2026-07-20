import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getStrictMembershipAccess } from "@/lib/membership-access";
import { getMemberAccount } from "@/lib/membership";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function copyForStatus(status: "pending" | "active" | "paused" | "expired") {
  if (status === "paused") {
    return {
      title: "Membership paused",
      description: "Your projects and generated-content history are unavailable while the membership is paused.",
      action: "Please contact the administrator to resolve the account status.",
    };
  }
  if (status === "expired") {
    return {
      title: "Membership expired",
      description: "Your current plan period has ended. Previous projects stay unavailable until a new period is activated.",
      action: "Please contact the administrator to renew or change your plan.",
    };
  }
  return {
    title: "Waiting for activation",
    description: "Your account is registered, but a membership plan has not been opened yet.",
    action: "The administrator can activate Trial, Basic, or Pro for this account.",
  };
}

export default async function MembershipStatusPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect("/login");

  const access = await getStrictMembershipAccess(user);
  if (access.allowed) redirect("/home");

  const account = await getMemberAccount(user.id);
  const content = copyForStatus(access.status);
  const plan = account.configured ? account.subscription?.plan : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-5 py-10">
      <div className="w-full max-w-md space-y-4">
        <header className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Consultant Marketing</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{content.title}</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-600">{content.description}</p>
        </header>

        <Card>
          <CardDescription>Signed in as</CardDescription>
          <CardTitle className="mt-1">{user.email}</CardTitle>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-neutral-500">Status</p>
              <p className="mt-1 font-semibold capitalize">{access.status}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Plan</p>
              <p className="mt-1 font-semibold">{plan?.name ?? "Not activated"}</p>
            </div>
          </div>
          <p className="mt-4 rounded-xl bg-neutral-100 px-3 py-3 text-sm leading-6 text-neutral-700">
            {content.action}
          </p>
        </Card>

        {!access.configured && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            Membership setup is unavailable or could not be verified. Access remains blocked until the database configuration is healthy.
          </div>
        )}

        <form action="/auth/logout" method="post">
          <Button type="submit" variant="outline" size="block">Log out</Button>
        </form>
      </div>
    </main>
  );
}
