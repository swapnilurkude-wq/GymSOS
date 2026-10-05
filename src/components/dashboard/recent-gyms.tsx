import { Link } from "react-router-dom"
import { ArrowUpRight, Building2 } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getGymStatus, GYM_STATUS_META } from "@/lib/gym-status"
import type { Gym } from "@/types"

const PLAN_BADGE: Record<Gym["plan"], string> = {
  trial: "Trial",
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export function RecentGyms({ gyms }: { gyms: Gym[] }) {
  const sorted = [...gyms].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <Card className="p-6">
      <CardHeader className="flex-row items-center justify-between p-0">
        <div>
          <CardTitle>Recently onboarded gyms</CardTitle>
          <CardDescription>Newest gyms to join the platform</CardDescription>
        </div>
        <Link
          to="/super-admin/gyms"
          className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View all
          <ArrowUpRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="p-0 pt-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-3 font-medium">Gym</th>
                <th className="pb-3 font-medium">Location</th>
                <th className="pb-3 font-medium">Plan</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 text-right font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 6).map((gym) => {
                const status = GYM_STATUS_META[getGymStatus(gym)]
                return (
                  <tr key={gym.id} className="border-t border-border/60">
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Building2 className="size-4" />
                        </span>
                        <p className="truncate font-medium text-foreground">{gym.name}</p>
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">{gym.location}</td>
                    <td className="py-3 text-muted-foreground">{PLAN_BADGE[gym.plan]}</td>
                    <td className="py-3">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                    <td className="py-3 text-right text-muted-foreground">{formatDate(gym.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
