import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
  ResponsiveContainer,
  type TooltipContentProps,
} from "recharts"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { formatCompactCurrency, formatNumber } from "@/lib/format"
import type { PlanRevenueRow } from "@/lib/revenue"

const ORDINAL_COLORS = [
  "var(--color-chart-ordinal-1)",
  "var(--color-chart-ordinal-2)",
  "var(--color-chart-ordinal-3)",
  "var(--color-chart-ordinal-4)",
]

function RevenueTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as PlanRevenueRow

  return (
    <div className="rounded-lg border border-border/60 bg-popover px-3.5 py-2.5 shadow-premium-lg">
      <p className="text-sm font-semibold text-foreground">{row.label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {formatNumber(row.gymCount)} gym{row.gymCount === 1 ? "" : "s"} · {formatCompactCurrency(row.revenue)}/mo
      </p>
    </div>
  )
}

export function RevenueByPlanChart({ data }: { data: PlanRevenueRow[] }) {
  return (
    <Card className="p-6">
      <CardHeader className="p-0">
        <CardTitle>Revenue by plan</CardTitle>
        <CardDescription>Monthly recurring revenue contributed by each tier</CardDescription>
      </CardHeader>
      <CardContent className="p-0 pt-6">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }}>
              <CartesianGrid horizontal={false} stroke="var(--color-chart-grid)" strokeWidth={1} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                axisLine={false}
                tickLine={false}
                width={72}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
              />
              <Tooltip content={(props) => <RevenueTooltip {...props} />} cursor={{ fill: "var(--color-accent)" }} />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {data.map((_, i) => (
                  <Cell key={i} fill={ORDINAL_COLORS[i % ORDINAL_COLORS.length]} />
                ))}
                <LabelList
                  dataKey="revenue"
                  position="right"
                  formatter={(value: string | number | boolean | null | undefined) =>
                    formatCompactCurrency(Number(value ?? 0))
                  }
                  style={{ fill: "var(--color-foreground)", fontSize: 12, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
