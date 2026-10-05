import { Check, X } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useGymPlan } from "@/hooks/use-gym-plan"

const FEATURE_ROWS: { key: "excelExport" | "excelImport" | "pdfReceipts" | "reports"; label: string }[] = [
  { key: "excelExport", label: "Excel export" },
  { key: "excelImport", label: "Excel import" },
  { key: "pdfReceipts", label: "PDF receipts" },
  { key: "reports", label: "Reports" },
]

export function PlanCard() {
  const { planLabel, features } = useGymPlan()

  return (
    <Card className="p-6">
      <CardHeader className="flex-row items-center justify-between p-0">
        <div>
          <CardTitle>Your plan</CardTitle>
          <CardDescription>Features and limits included with your subscription</CardDescription>
        </div>
        <Badge variant="success">{planLabel}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-0 pt-6">
        <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Member limit</span>
          <span className="font-medium text-foreground">
            {features.maxMembers === null ? "Unlimited" : `${features.maxMembers} members`}
          </span>
        </div>

        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FEATURE_ROWS.map((row) => {
            const enabled = features[row.key]
            return (
              <li
                key={row.key}
                className="flex items-center gap-2 rounded-lg border border-border/60 px-4 py-2.5 text-sm"
              >
                {enabled ? (
                  <Check className="size-4 shrink-0 text-success" />
                ) : (
                  <X className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className={enabled ? "text-foreground" : "text-muted-foreground"}>{row.label}</span>
              </li>
            )
          })}
        </ul>

        <p className="text-xs text-muted-foreground">
          Contact your GymSOS account manager to upgrade your plan.
        </p>
      </CardContent>
    </Card>
  )
}
