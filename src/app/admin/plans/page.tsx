import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listMembershipPlans } from "@/lib/membership";
import { updatePlanAction } from "../actions";

function money(sen: number | null) {
  if (sen === null) return "—";
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(sen / 100);
}

export default async function PlansAdminPage() {
  try {
    const plans = await listMembershipPlans();
    return (
      <div className="space-y-6">
        <header>
          <p className="text-sm text-neutral-500">Pricing and monthly allowances</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Plans</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
            Changes affect new activations and future automatic monthly resets. They do not silently rewrite credits already used in the current period.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">{plan.code}</p>
                  <h2 className="mt-1 text-2xl font-semibold">{plan.name}</h2>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs ${plan.is_active ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-600"}`}>
                  {plan.is_active ? "Active" : "Hidden"}
                </span>
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-neutral-500">Initial price</dt><dd className="font-medium">{money(plan.initial_price_sen)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-neutral-500">Renewal</dt><dd className="font-medium">{money(plan.renewal_price_sen)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-neutral-500">Copy</dt><dd className="font-medium">{plan.copy_limit}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-neutral-500">Images</dt><dd className="font-medium">{plan.image_limit}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-neutral-500">Period</dt><dd className="font-medium">{plan.billing_type === "one_time" ? `${plan.trial_days ?? 30} days` : "Monthly"}</dd></div>
              </dl>

              <details className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold">Edit plan</summary>
                <form action={updatePlanAction} className="mt-4 space-y-3">
                  <input type="hidden" name="planId" value={plan.id} />
                  <label className="block text-sm font-medium">
                    Initial price (RM)
                    <Input name="initialPrice" type="number" min="0" step="0.01" required defaultValue={(plan.initial_price_sen / 100).toFixed(2)} />
                  </label>
                  <label className="block text-sm font-medium">
                    Renewal price (RM)
                    <Input name="renewalPrice" type="number" min="0" step="0.01" defaultValue={plan.renewal_price_sen === null ? "" : (plan.renewal_price_sen / 100).toFixed(2)} placeholder="Leave blank for one-time" />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-sm font-medium">
                      Copy limit
                      <Input name="copyLimit" type="number" min="0" step="1" required defaultValue={plan.copy_limit} />
                    </label>
                    <label className="block text-sm font-medium">
                      Image limit
                      <Input name="imageLimit" type="number" min="0" step="1" required defaultValue={plan.image_limit} />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input name="isActive" type="checkbox" defaultChecked={plan.is_active} />
                    Available for new activations
                  </label>
                  <label className="block text-sm font-medium">
                    Change reason
                    <Input name="reason" required minLength={3} placeholder="Pricing decision, allowance review…" />
                  </label>
                  <Button type="submit" size="block">Save audited change</Button>
                </form>
              </details>
            </article>
          ))}
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h1 className="text-xl font-semibold text-amber-950">Membership database is not ready</h1>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          {error instanceof Error ? error.message : "Could not load plan data."}
        </p>
      </div>
    );
  }
}
