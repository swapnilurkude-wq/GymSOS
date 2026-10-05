import { MoreHorizontal, RefreshCw, CreditCard, Ban, CheckCircle, CreditCard as CardIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PlanFeatureTooltip } from "@/components/shared/plan-feature-tooltip"
import { formatCurrency, formatRelativeDays } from "@/lib/format"
import { getGymStatus, GYM_STATUS_META } from "@/lib/gym-status"
import { GYM_PLAN_FEE } from "@/types"
import type { Gym } from "@/types"

const PLAN_LABEL: Record<Gym["plan"], string> = {
  trial: "Trial",
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

interface SubscriptionTableProps {
  gyms: Gym[]
  onRenew: (gym: Gym) => void
  onChangePlan: (gym: Gym) => void
  onToggleSuspend: (gym: Gym) => void
}

export function SubscriptionTable({ gyms, onRenew, onChangePlan, onToggleSuspend }: SubscriptionTableProps) {
  if (gyms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CardIcon className="size-6" />
        </div>
        <p className="font-display text-base font-semibold text-foreground">No subscriptions found</p>
        <p className="max-w-sm text-sm text-muted-foreground">Try adjusting your search or filters.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-premium">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
            <th className="px-5 py-3 font-medium">Gym</th>
            <th className="px-5 py-3 font-medium">Plan</th>
            <th className="px-5 py-3 font-medium">Monthly fee</th>
            <th className="px-5 py-3 font-medium">Renewal</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {gyms.map((gym) => {
            const displayStatus = getGymStatus(gym)
            const status = GYM_STATUS_META[displayStatus]
            const isSuspended = gym.status === "suspended"

            return (
              <tr key={gym.id} className="border-b border-border/40 last:border-0 hover:bg-secondary/30">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-foreground">{gym.name}</p>
                  <p className="text-xs text-muted-foreground">{gym.ownerName}</p>
                </td>
                <td className="px-5 py-3.5">
                  <PlanFeatureTooltip plan={gym.plan}>
                    <Badge variant="secondary">{PLAN_LABEL[gym.plan]}</Badge>
                  </PlanFeatureTooltip>
                </td>
                <td className="px-5 py-3.5 tabular-nums text-foreground">
                  {GYM_PLAN_FEE[gym.plan] === 0 ? "Free" : formatCurrency(GYM_PLAN_FEE[gym.plan])}
                </td>
                <td className="px-5 py-3.5">
                  <p className="text-foreground">{formatDate(gym.subscriptionEndDate)}</p>
                  <p
                    className={
                      displayStatus === "expired"
                        ? "text-xs text-destructive"
                        : displayStatus === "renewal-due"
                          ? "text-xs text-warning"
                          : "text-xs text-muted-foreground"
                    }
                  >
                    {formatRelativeDays(gym.subscriptionEndDate)}
                  </p>
                </td>
                <td className="px-5 py-3.5">
                  <Badge variant={status.variant}>{status.label}</Badge>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onRenew(gym)}>
                        <RefreshCw /> Renew subscription
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onChangePlan(gym)}>
                        <CreditCard /> Change plan
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onToggleSuspend(gym)}>
                        {isSuspended ? <CheckCircle /> : <Ban />}
                        {isSuspended ? "Activate account" : "Suspend account"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
