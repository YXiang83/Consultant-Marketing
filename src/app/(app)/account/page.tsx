import { supabaseServer } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default async function AccountPage() {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;

  const [{ data: profile }, { data: sub }, { data: balance }] = await Promise.all([
    supabase.from("profiles").select("display_name, preferred_language").maybeSingle(),
    supabase
      .from("subscriptions")
      .select("status, current_period_end, plan:subscription_plans(name, code)")
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("usage_balances")
      .select("copy_used, copy_limit, image_used, image_limit, period_end")
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const plan = Array.isArray(sub?.plan) ? sub?.plan[0] : sub?.plan;

  return (
    <main className="flex flex-col gap-4 px-6 pb-6 pt-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-neutral-500">{user?.email}</p>
      </header>

      <Card>
        <CardDescription>Signed in as</CardDescription>
        <CardTitle className="mt-1">{profile?.display_name || user?.email}</CardTitle>
      </Card>

      <Card>
        <CardDescription>Current plan</CardDescription>
        <CardTitle className="mt-1">{plan?.name ?? "—"}</CardTitle>
        <p className="mt-1 text-xs text-neutral-500 capitalize">{sub?.status ?? "no subscription"}</p>
      </Card>

      <Card>
        <CardDescription>Usage this period</CardDescription>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-neutral-500">Copy</p>
            <p className="text-lg font-semibold">
              {balance ? `${balance.copy_used} / ${balance.copy_limit}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Images</p>
            <p className="text-lg font-semibold">
              {balance ? `${balance.image_used} / ${balance.image_limit}` : "—"}
            </p>
          </div>
        </div>
      </Card>

      <form action="/auth/logout" method="post">
        <Button variant="outline" size="block" type="submit">
          Log out
        </Button>
      </form>
    </main>
  );
}
