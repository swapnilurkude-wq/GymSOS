import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { formatCurrency, formatNumber } from "@/lib/format"
import type { PlanRevenueRow } from "@/lib/revenue"

export function PlanBreakdownTable({ data }: { data: PlanRevenueRow[] }) {
  const totalRevenue = data.reduce((sum, row) => sum + row.revenue, 0)

  return (
    <Card className="p-6">
      <CardHeader className="p-0">
        <CardTitle>Plan breakdown</CardTitle>
        <CardDescription>Gyms, revenue, and share of MRR per tier</CardDescription>
      </CardHeader>
      <CardContent className="p-0 pt-5">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
              <th className="py-2.5 font-medium">Plan</th>
              <th className="py-2.5 font-medium">Gyms</th>
              <th className="py-2.5 font-medium">Revenue</th>
              <th className="py-2.5 text-right font-medium">Share of MRR</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.plan} className="border-b border-border/40 last:border-0">
                <td className="py-3 font-medium text-foreground">{row.label}</td>
                <td className="py-3 tabular-nums text-muted-foreground">{formatNumber(row.gymCount)}</td>
                <td className="py-3 tabular-nums text-foreground">{formatCurrency(row.revenue)}</td>
                <td className="py-3 text-right tabular-nums text-muted-foreground">
                  {totalRevenue > 0 ? ((row.revenue / totalRevenue) * 100).toFixed(0) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
