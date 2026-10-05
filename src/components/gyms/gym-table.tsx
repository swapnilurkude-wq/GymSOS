import { MoreHorizontal, Pencil, Trash2, Building2 } from "lucide-react"
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
import { formatNumber } from "@/lib/format"
import { getGymStatus, GYM_STATUS_META } from "@/lib/gym-status"
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

interface GymTableProps {
  gyms: Gym[]
  onEdit: (gym: Gym) => void
  onDelete: (gym: Gym) => void
}

export function GymTable({ gyms, onEdit, onDelete }: GymTableProps) {
  if (gyms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Building2 className="size-6" />
        </div>
        <p className="font-display text-base font-semibold text-foreground">No gyms found</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Try adjusting your search or filters, or onboard a new gym to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-premium">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
            <th className="px-5 py-3 font-medium">Gym</th>
            <th className="px-5 py-3 font-medium">Owner</th>
            <th className="px-5 py-3 font-medium">Plan</th>
            <th className="px-5 py-3 font-medium">Members</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Subscription</th>
            <th className="px-5 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {gyms.map((gym) => {
            const status = GYM_STATUS_META[getGymStatus(gym)]
            return (
              <tr key={gym.id} className="border-b border-border/40 last:border-0 hover:bg-secondary/30">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{gym.name}</p>
                      <p className="text-xs text-muted-foreground">{gym.location}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <p className="text-foreground">{gym.ownerName}</p>
                  <p className="text-xs text-muted-foreground">{gym.ownerEmail}</p>
                </td>
                <td className="px-5 py-3.5">
                  <PlanFeatureTooltip plan={gym.plan}>
                    <Badge variant="secondary">{PLAN_LABEL[gym.plan]}</Badge>
                  </PlanFeatureTooltip>
                </td>
                <td className="px-5 py-3.5 tabular-nums text-foreground">{formatNumber(gym.memberCount)}</td>
                <td className="px-5 py-3.5">
                  <Badge variant={status.variant}>{status.label}</Badge>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{formatDate(gym.subscriptionEndDate)}</td>
                <td className="px-5 py-3.5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(gym)}>
                        <Pencil /> Edit gym
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => onDelete(gym)}>
                        <Trash2 /> Delete gym
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
