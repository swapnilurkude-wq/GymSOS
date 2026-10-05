import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, type TooltipContentProps } from "recharts"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { formatNumber } from "@/lib/format"
import type { PlanMixSlice } from "@/data/dashboard-mock"

const SLOT_COLORS = [
  "var(--color-chart-cat-1)",
  "var(--color-chart-cat-2)",
  "var(--color-chart-cat-3)",
  "var(--color-chart-cat-4)",
]

function PlanTooltip({ active, payload, unitLabel }: TooltipContentProps & { unitLabel: string }) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  const name = String(entry?.name)
  const value = Number(entry?.value)

  return (
    <div className="rounded-lg border border-border/60 bg-popover px-3.5 py-2.5 shadow-premium-lg">
      <p className="flex items-center gap-1.5 font-display text-sm font-semibold text-foreground">
        <span
          className="inline-block size-2 rounded-full"
          style={{ backgroundColor: entry?.color }}
        />
        {name}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{formatNumber(value)} {unitLabel}</p>
    </div>
  )
}

interface PlanMixChartProps {
  data: PlanMixSlice[]
  title?: string
  description?: string
  centerLabel?: string
  unitLabel?: string
}

export function PlanMixChart({
  data,
  title = "Plan mix",
  description = "Active members by membership plan",
  centerLabel = "Total members",
  unitLabel = "members",
}: PlanMixChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <Card className="p-6">
      <CardHeader className="p-0">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0 pt-6">
        <div className="relative h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="68%"
                outerRadius="100%"
                paddingAngle={2}
                stroke="var(--color-card)"
                strokeWidth={2}
                isAnimationActive
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={SLOT_COLORS[i % SLOT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={(props) => <PlanTooltip {...props} unitLabel={unitLabel} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-display text-2xl font-bold text-foreground">{formatNumber(total)}</p>
            <p className="text-xs text-muted-foreground">{centerLabel}</p>
          </div>
        </div>

        <ul className="mt-5 grid grid-cols-2 gap-3">
          {data.map((slice, i) => (
            <li key={slice.name} className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: SLOT_COLORS[i % SLOT_COLORS.length] }}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{slice.name}</span>
              <span className="text-xs font-medium text-muted-foreground">
                {total > 0 ? ((slice.value / total) * 100).toFixed(0) : "0"}%
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
