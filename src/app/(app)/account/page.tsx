import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getMemberAccount, isConfiguredAdmin } from "@/lib/membership";
import { supabaseServer } from "@/lib/supabase/server";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));
}

export default async function AccountPage() {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  const account = user ? await getMemberAccount(user.id) : null;
  const admin = isConfiguredAdmin(user);

  const member = account?.configured ? account.member : null;
  const subscription = account?.configured ? account.subscription : null;
  const balance = account?.configured ? account.balance : null;

  return (
    <main className="flex flex-col gap-4 px-6 pb-6 pt-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-neutral-500">{user?.email}</p>
      </header>

      <Card>
        <CardDescription>Signed in as</CardDescription>
        <CardTitle className="mt-1">{member?.display_name || user?.user_metadata?.display_name || user?.email}</CardTitle>
        {admin && <p className="mt-2 text-xs font-medium text-emerald-700">Product administrator</p>}
      </Card>

      <Card>
        <CardDescription>Current membership</CardDescription>
        <CardTitle className="mt-1">{subscription?.plan?.name ?? (admin ? "Administrator access" : "Not activated")}</CardTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-neutral-500">Status</p>
            <p className="mt-1 font-semibold capitalize">{member?.status ?? (admin ? "active" : "pending")}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Period ends</p>
            <p className="mt-1 font-semibold">{formatDate(subscription?.current_period_end)}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardDescription>Usage this period</CardDescription>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-neutral-500">Copy</p>
            <p className="text-lg font-semibold">{balance ? `${balance.copy_used} / ${balance.copy_limit}` : "—"}</p>
            <p className="text-xs text-neutral-500">Content and sales share this allowance.</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Images</p>
            <p className="text-lg font-semibold">{balance ? `${balance.image_used} / ${balance.image_limit}` : "—"}</p>
            <p className="text-xs text-neutral-500">Each generated or edited image uses one.</p>
          </div>
        </div>
      </Card>

      {account && !account.configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Membership data is not configured in this environment yet. {account.error}
        </div>
      )}

      <form action="/auth/logout" method="post">
        <Button variant="outline" size="block" type="submit">Log out</Button>
      </form>
    </main>
  );
}
