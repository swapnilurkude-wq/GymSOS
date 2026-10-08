import { Badge } from "@/components/ui/badge"
import { GYM_STATUS_META, getTrialState } from "@/lib/gym-status"
import type { Gym } from "@/types"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/**
 * "Trial Signups" section for the Super Admin
 * subscriptions page — every public signup lands
 * here automatically (plan = 'trial' gyms).
 *
 * Passwords are never shown: they live only in
 * Supabase Auth, hashed.
 */
export function TrialSignupsTable({ gyms }: { gyms: Gym[] }) {
  const trialGyms = [...gyms]
    .filter((gym) => gym.plan === "trial")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

  if (trialGyms.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        <p className="font-display text-base font-semibold text-foreground">
          No trial signups yet
        </p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          New gym owners who start a 10-day free trial from the signup
          page will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-premium">
      <table className="w-full min-w-[1020px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
            <th className="px-5 py-3 font-medium">Gym</th>
            <th className="px-5 py-3 font-medium">Owner</th>
            <th className="px-5 py-3 font-medium">Mobile</th>
            <th className="px-5 py-3 font-medium">Email</th>
            <th className="px-5 py-3 font-medium">Signup date</th>
            <th className="px-5 py-3 font-medium">Trial start</th>
            <th className="px-5 py-3 font-medium">Trial end</th>
            <th className="px-5 py-3 font-medium">Trial status</th>
            <th className="px-5 py-3 font-medium">Account status</th>
          </tr>
        </thead>
        <tbody>
          {trialGyms.map((gym) => {
            const trialState = getTrialState(gym)
            const account = GYM_STATUS_META[gym.status]

            return (
              <tr
                key={gym.id}
                className="border-b border-border/40 last:border-0 hover:bg-secondary/30"
              >
                <td className="px-5 py-3.5 font-medium text-foreground">
                  {gym.name}
                </td>
                <td className="px-5 py-3.5 text-foreground">
                  {gym.ownerName}
                </td>
                <td className="px-5 py-3.5 tabular-nums text-foreground">
                  {gym.ownerContact || "—"}
                </td>
                <td className="px-5 py-3.5 text-foreground">
                  {gym.ownerEmail || "—"}
                </td>
                <td className="px-5 py-3.5 tabular-nums text-muted-foreground">
                  {formatDate(gym.createdAt)}
                </td>
                <td className="px-5 py-3.5 tabular-nums text-muted-foreground">
                  {formatDate(gym.createdAt)}
                </td>
                <td className="px-5 py-3.5 tabular-nums text-muted-foreground">
                  {formatDate(gym.subscriptionEndDate)}
                </td>
                <td className="px-5 py-3.5">
                  <Badge
                    variant={
                      trialState === "expired" ? "destructive" : "success"
                    }
                  >
                    {trialState === "expired" ? "Expired" : "Active trial"}
                  </Badge>
                </td>
                <td className="px-5 py-3.5">
                  <Badge
                    variant={
                      account.variant === "destructive"
                        ? "destructive"
                        : account.variant === "warning"
                          ? "warning"
                          : "success"
                    }
                  >
                    {account.label}
                  </Badge>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
