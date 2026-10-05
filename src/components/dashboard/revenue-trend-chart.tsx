import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipContentProps,
} from "recharts"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { formatCompactCurrency } from "@/lib/format"
import type { RevenuePoint } from "@/data/dashboard-mock"

function RevenueTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const value = Number(payload[0]?.value)

  return (
    <div className="rounded-lg border border-border/60 bg-popover px-3.5 py-2.5 shadow-premium-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 font-display text-sm font-semibold text-foreground">
        <span className="inline-block h-[2px] w-3 rounded-full bg-primary" />
        {formatCompactCurrency(value)}
      </p>
    </div>
  )
}

interface RevenueTrendChartProps {
  data: RevenuePoint[]
  title?: string
  description?: string
}

export function RevenueTrendChart({
  data,
  title = "Revenue trend",
  description = "Monthly collections over the last 8 months",
}: RevenueTrendChartProps) {
  return (
    <Card className="p-6">
      <CardHeader className="p-0">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0 pt-6">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--color-chart-grid)"
                strokeWidth={1}
              />
              <XAxis
                dataKey="label"
                axisLine={{ stroke: "var(--color-chart-grid)" }}
                tickLine={false}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                tickFormatter={(v: number) => formatCompactCurrency(v)}
                width={56}
              />
              <Tooltip content={(props) => <RevenueTooltip {...props} />} cursor={{ stroke: "var(--color-chart-axis)", strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill="url(#revenue-fill)"
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
