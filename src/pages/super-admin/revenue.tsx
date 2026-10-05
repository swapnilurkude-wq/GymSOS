import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Wallet, TrendingUp, Users, Calculator } from "lucide-react"
import { getAllGyms } from "@/lib/gyms"
import { computeRevenueBreakdown, computeRevenueSummary } from "@/lib/revenue"
import { StatCard } from "@/components/shared/stat-card"
import { RevenueTrendChart } from "@/components/dashboard/revenue-trend-chart"
import { RevenueByPlanChart } from "@/components/revenue/revenue-by-plan-chart"
import { PlanBreakdownTable } from "@/components/revenue/plan-breakdown-table"
import { computePlatformRevenueTrend } from "@/lib/super-admin-dashboard-stats"
import type { Gym } from "@/types"

export default function RevenueDashboardPage() {
  const [gyms, setGyms] = useState<Gym[]>([])

  useEffect(() => {
    let cancelled = false
    getAllGyms()
      .then((rows) => {
        if (!cancelled) setGyms(rows)
      })
      .catch(() => {
        if (!cancelled) setGyms([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const summary = useMemo(() => computeRevenueSummary(gyms), [gyms])
  const breakdown = useMemo(() => computeRevenueBreakdown(gyms), [gyms])
  const revenueTrend = useMemo(() => computePlatformRevenueTrend(gyms), [gyms])

  return (
    <div className="flex flex-col gap-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1"
      >
        <h1 className="font-display text-xl font-semibold text-foreground">Revenue Dashboard</h1>
        <p className="text-sm text-muted-foreground">Platform-wide billing performance</p>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Monthly Recurring Revenue" value={summary.mrr} format="currency" tone="brand" />
        <StatCard icon={TrendingUp} label="Annual Recurring Revenue" value={summary.arr} format="currency" tone="success" />
        <StatCard icon={Users} label="Paying Gyms" value={summary.payingGymCount} tone="brand" />
        <StatCard icon={Calculator} label="Avg. Revenue per Gym" value={summary.avgPerGym} format="currency" tone="warning" />
      </div>

      <RevenueTrendChart
        data={revenueTrend}
        title="Platform revenue trend"
        description="Monthly recurring revenue over the last 8 months"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RevenueByPlanChart data={breakdown} />
        <PlanBreakdownTable data={breakdown} />
      </div>
    </div>
  )
}
