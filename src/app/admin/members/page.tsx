import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listMembers, listMembershipPlans } from "@/lib/membership";
import {
  activateMemberAction,
  adjustQuotaAction,
  pauseMemberAction,
  resumeMemberAction,
  updateMemberProfileAction,
} from "../actions";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === "active") return "bg-emerald-100 text-emerald-800";
  if (status === "paused") return "bg-amber-100 text-amber-800";
  if (status === "expired") return "bg-red-100 text-red-800";
  return "bg-neutral-100 text-neutral-700";
}

export default async function MembersAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  try {
    const [members, plans] = await Promise.all([listMembers(q), listMembershipPlans()]);

    return (
      <div className="space-y-6">
        <header>
          <p className="text-sm text-neutral-500">Only the configured administrator can use this page.</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Members</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
            Registered users remain pending until you start a plan. Profile changes, activation, pause, resume, plan changes, and quota adjustments are all audited.
          </p>
        </header>

        <form method="get" className="flex gap-2 rounded-2xl border border-neutral-200 bg-white p-3">
          <Input name="q" defaultValue={q} placeholder="Search email, name, status, or plan" />
          <Button type="submit">Search</Button>
        </form>

        <p className="text-sm text-neutral-500">{members.length} member{members.length === 1 ? "" : "s"}</p>

        <div className="space-y-4">
          {members.map((member) => (
            <article key={member.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{member.displayName}</h2>
                  <p className="text-sm text-neutral-600">{member.email}</p>
                  {member.phone && <p className="mt-1 text-xs text-neutral-500">{member.phone}</p>}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(member.status)}`}>
                  {member.status}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-neutral-500">Plan</dt>
                  <dd className="mt-1 font-medium">{member.plan?.name ?? "Not activated"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Copy usage</dt>
                  <dd className="mt-1 font-medium">{member.copyUsed} / {member.copyLimit}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Image usage</dt>
                  <dd className="mt-1 font-medium">{member.imageUsed} / {member.imageLimit}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Period ends</dt>
                  <dd className="mt-1 font-medium">{formatDate(member.periodEnd)}</dd>
                </div>
              </dl>

              <div className="mt-4 grid gap-2 text-xs text-neutral-500 sm:grid-cols-2">
                <p>Registered: {formatDate(member.authCreatedAt)}</p>
                <p>Last sign in: {formatDate(member.lastSignInAt)}</p>
              </div>

              <details className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold">Manage member</summary>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <form action={updateMemberProfileAction} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 lg:col-span-2">
                    <input type="hidden" name="userId" value={member.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-medium">
                        Display name
                        <Input name="displayName" defaultValue={member.displayName} maxLength={120} />
                      </label>
                      <label className="block text-sm font-medium">
                        Phone
                        <Input name="phone" defaultValue={member.phone ?? ""} maxLength={60} />
                      </label>
                    </div>
                    <label className="block text-sm font-medium">
                      Internal notes
                      <textarea
                        name="internalNotes"
                        defaultValue={member.internalNotes ?? ""}
                        maxLength={2000}
                        rows={3}
                        className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      Change reason
                      <Input name="reason" required minLength={3} maxLength={500} placeholder="Corrected name, updated phone, added account note…" />
                    </label>
                    <Button type="submit" variant="outline">Save member details</Button>
                  </form>

                  <form action={activateMemberAction} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
                    <input type="hidden" name="userId" value={member.id} />
                    <label className="block text-sm font-medium">
                      Start or change plan
                      <select
                        name="planCode"
                        defaultValue={member.plan?.code ?? "trial"}
                        className="mt-1 block h-11 w-full rounded-xl border border-neutral-300 bg-white px-3"
                      >
                        {plans.map((plan) => (
                          <option key={plan.id} value={plan.code}>
                            {plan.name} · {plan.copy_limit} copy · {plan.image_limit} images
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm font-medium">
                      Reason
                      <Input name="reason" required minLength={3} placeholder="Payment received, manual activation, plan change…" />
                    </label>
                    <Button type="submit" size="block">
                      Start a new allowance period
                    </Button>
                    <p className="text-xs leading-5 text-neutral-500">
                      This resets used credits to zero and starts a fresh Trial or monthly period.
                    </p>
                  </form>

                  <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
                    {member.status === "active" ? (
                      <form action={pauseMemberAction} className="space-y-3">
                        <input type="hidden" name="userId" value={member.id} />
                        <label className="block text-sm font-medium">
                          Pause reason
                          <Input name="reason" required minLength={3} placeholder="Reason shown in the audit log" />
                        </label>
                        <Button type="submit" variant="destructive" size="block">
                          Pause membership
                        </Button>
                        <p className="text-xs leading-5 text-neutral-500">
                          A paused member cannot open projects or generated-content history.
                        </p>
                      </form>
                    ) : member.status === "paused" ? (
                      <form action={resumeMemberAction} className="space-y-3">
                        <input type="hidden" name="userId" value={member.id} />
                        <label className="block text-sm font-medium">
                          Resume reason
                          <Input name="reason" required minLength={3} placeholder="Issue resolved, payment confirmed…" />
                        </label>
                        <Button type="submit" size="block">Resume remaining period</Button>
                        <p className="text-xs leading-5 text-neutral-500">
                          If the period has already expired, start a new plan period instead.
                        </p>
                      </form>
                    ) : (
                      <p className="text-sm leading-6 text-neutral-600">
                        Activate a plan to give this member access.
                      </p>
                    )}
                  </div>

                  <form action={adjustQuotaAction} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 lg:col-span-2">
                    <input type="hidden" name="userId" value={member.id} />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="block text-sm font-medium">
                        Allowance
                        <select name="kind" className="mt-1 block h-11 w-full rounded-xl border border-neutral-300 bg-white px-3">
                          <option value="copy">Copy</option>
                          <option value="image">Image</option>
                        </select>
                      </label>
                      <label className="block text-sm font-medium">
                        Change
                        <Input name="delta" type="number" required step="1" placeholder="Use +5 or -5" />
                      </label>
                      <label className="block text-sm font-medium sm:col-span-1">
                        Reason
                        <Input name="reason" required minLength={3} placeholder="Bonus, correction, refund…" />
                      </label>
                    </div>
                    <Button type="submit" variant="outline">Adjust quota</Button>
                  </form>
                </div>
              </details>
            </article>
          ))}

          {members.length === 0 && (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
              No matching members.
            </div>
          )}
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h1 className="text-xl font-semibold text-amber-950">Membership database is not ready</h1>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          {error instanceof Error ? error.message : "Could not load membership data."}
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          The reviewed migration must be approved and executed, and the consultant_marketing schema must be exposed in Supabase API settings.
        </p>
      </div>
    );
  }
}
