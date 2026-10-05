import { Lock } from "lucide-react"
import { Card } from "@/components/ui/card"

interface PlanUpgradeNoticeProps {
  title: string
  description: string
  requiredPlanLabel: string
}

export function PlanUpgradeNotice({ title, description, requiredPlanLabel }: PlanUpgradeNoticeProps) {
  return (
    <Card className="flex flex-col items-center gap-3 border-dashed px-6 py-20 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Lock className="size-6" />
      </div>
      <p className="font-display text-base font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      <p className="mt-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
        Available on the {requiredPlanLabel} plan and above
      </p>
    </Card>
  )
}
