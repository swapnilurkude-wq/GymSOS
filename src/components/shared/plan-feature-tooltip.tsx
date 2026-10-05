import { Check, X } from "lucide-react"
import type { ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getPlanFeatures } from "@/lib/plan-features"
import type { GymPlan } from "@/types"

const FEATURE_ROWS: { key: "excelExport" | "excelImport" | "pdfReceipts" | "reports"; label: string }[] = [
  { key: "excelExport", label: "Excel export" },
  { key: "excelImport", label: "Excel import" },
  { key: "pdfReceipts", label: "PDF receipts" },
  { key: "reports", label: "Reports" },
]

interface PlanFeatureTooltipProps {
  plan: GymPlan
  children: ReactNode
}

export function PlanFeatureTooltip({ plan, children }: PlanFeatureTooltipProps) {
  const features = getPlanFeatures(plan)

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-1.5">
          <p className="font-semibold">
            Member limit: {features.maxMembers === null ? "Unlimited" : features.maxMembers}
          </p>
          <ul className="flex flex-col gap-1">
            {FEATURE_ROWS.map((row) => (
              <li key={row.key} className="flex items-center gap-1.5">
                {features[row.key] ? (
                  <Check className="size-3 shrink-0" />
                ) : (
                  <X className="size-3 shrink-0 opacity-50" />
                )}
                {row.label}
              </li>
            ))}
          </ul>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
