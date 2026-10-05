import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReportTypeCardProps {
  icon: LucideIcon
  label: string
  count: number
  active: boolean
  onClick: () => void
}

export function ReportTypeCard({ icon: Icon, label, count, active, onClick }: ReportTypeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-4 text-left transition-all",
        active
          ? "border-primary/50 bg-primary/5 shadow-premium"
          : "border-border/60 bg-card hover:border-primary/30 hover:bg-secondary/40"
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{count} record{count === 1 ? "" : "s"}</p>
      </div>
    </button>
  )
}
