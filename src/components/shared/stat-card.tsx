import { motion } from "framer-motion"
import { AreaChart, Area, ResponsiveContainer } from "recharts"
import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useCountUp } from "@/hooks/use-count-up"
import { formatCompactCurrency, formatNumber, formatSignedPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

type StatTone = "brand" | "success" | "warning" | "danger"

const TONE_STYLES: Record<StatTone, { icon: string; stroke: string; fill: string }> = {
  brand: {
    icon: "bg-primary/10 text-primary",
    stroke: "var(--color-primary)",
    fill: "var(--color-primary)",
  },
  success: {
    icon: "bg-success/10 text-success",
    stroke: "var(--color-success)",
    fill: "var(--color-success)",
  },
  warning: {
    icon: "bg-warning/10 text-warning",
    stroke: "var(--color-warning)",
    fill: "var(--color-warning)",
  },
  danger: {
    icon: "bg-destructive/10 text-destructive",
    stroke: "var(--color-destructive)",
    fill: "var(--color-destructive)",
  },
}

export interface StatCardProps {
  icon: LucideIcon
  label: string
  value: number
  format?: "number" | "currency"
  tone?: StatTone
  context?: string
  delta?: number
  deltaGoodDirection?: "up" | "down"
  sparkline?: number[]
  index?: number
}

export function StatCard({
  icon: Icon,
  label,
  value,
  format = "number",
  tone = "brand",
  context,
  delta,
  deltaGoodDirection = "up",
  sparkline,
  index = 0,
}: StatCardProps) {
  const animatedValue = useCountUp(value)
  const toneStyle = TONE_STYLES[tone]

  const isGood =
    delta !== undefined &&
    ((deltaGoodDirection === "up" && delta >= 0) || (deltaGoodDirection === "down" && delta <= 0))

  const displayValue =
    format === "currency" ? formatCompactCurrency(animatedValue) : formatNumber(animatedValue)

  const sparklineData = sparkline && sparkline.length > 0 ? sparkline.map((v, i) => ({ i, v })) : null
  const gradientId = `spark-${label.replace(/\s+/g, "-").toLowerCase()}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
    >
      <Card className="group relative overflow-hidden p-5 transition-shadow hover:shadow-premium-lg">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", toneStyle.icon)}>
            <Icon className="size-5" />
          </div>
          {delta !== undefined && (
            <span
              className={cn(
                "flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-semibold",
                isGood ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              )}
            >
              {delta >= 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
              {formatSignedPercent(delta)}
            </span>
          )}
        </div>

        <p className="mt-4 text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-[26px] font-bold leading-tight text-foreground">
          {displayValue}
        </p>
        {context && <p className="mt-1 text-xs text-muted-foreground">{context}</p>}

        {sparklineData && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 opacity-70">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={toneStyle.fill} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={toneStyle.fill} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={toneStyle.stroke}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </motion.div>
  )
}
