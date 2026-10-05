import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency, formatNumber } from "@/lib/format"
import { getPlanFeatures } from "@/lib/plan-features"
import { GYM_PLAN_FEE } from "@/types"
import type { Gym, GymPlan } from "@/types"

const PLAN_LABEL: Record<GymPlan, string> = {
  trial: "Trial",
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
}

interface ChangePlanDialogProps {
  gym: Gym | null
  onOpenChange: (open: boolean) => void
  onConfirm: (plan: GymPlan) => void
}

export function ChangePlanDialog({ gym, onOpenChange, onConfirm }: ChangePlanDialogProps) {
  const [plan, setPlan] = useState<GymPlan>("trial")

  useEffect(() => {
    if (gym) setPlan(gym.plan)
  }, [gym])

  const targetFeatures = getPlanFeatures(plan)
  const exceedsMemberCap =
    !!gym && targetFeatures.maxMembers !== null && gym.memberCount > targetFeatures.maxMembers

  return (
    <Dialog open={!!gym} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change subscription plan</DialogTitle>
          <DialogDescription>
            Update the billing tier for {gym?.name}. This takes effect immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          <Select value={plan} onValueChange={(v) => setPlan(v as GymPlan)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PLAN_LABEL) as GymPlan[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PLAN_LABEL[p]} — {GYM_PLAN_FEE[p] === 0 ? "Free" : `${formatCurrency(GYM_PLAN_FEE[p])}/mo`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {exceedsMemberCap && gym && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                This gym has {formatNumber(gym.memberCount)} members, but {PLAN_LABEL[plan]} only allows{" "}
                {targetFeatures.maxMembers}. Existing members stay, but the owner won't be able to add more
                until they're under the limit.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(plan)}>
            {exceedsMemberCap ? "Change plan anyway" : "Save plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
