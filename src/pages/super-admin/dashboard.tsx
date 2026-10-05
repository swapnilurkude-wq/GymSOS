import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  ShieldCheck,
  Building2,
  CheckCircle2,
  Wallet,
  CreditCard,
  CalendarClock,
  UserPlus,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { StatCard } from "@/components/shared/stat-card"
import { RevenueTrendChart } from "@/components/dashboard/revenue-trend-chart"
import { PlanMixChart } from "@/components/dashboard/plan-mix-chart"
import { RecentGyms } from "@/components/dashboard/recent-gyms"
import { getAllGyms } from "@/lib/gyms"
import type { Gym } from "@/types"
import {
  computePlatformKpiStats,
  computePlatformRevenueTrend,
  computeGymPlanDistribution,
} from "@/lib/super-admin-dashboard-stats"

const STAT_ICONS: Record<string, LucideIcon> = {
  "total-gyms": Building2,
  "active-gyms": CheckCircle2,
  mrr: Wallet,
  "active-subscriptions": CreditCard,
  "expiring-subscriptions": CalendarClock,
  "new-signups": UserPlus,
  "at-risk-gyms": AlertTriangle,
}

export default function SuperAdminDashboard() {
  const { session } = useAuth()
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

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  const kpiStats = useMemo(() => computePlatformKpiStats(gyms), [gyms])
  const revenueTrend = useMemo(() => computePlatformRevenueTrend(gyms), [gyms])
  const planDistribution = useMemo(() => computeGymPlanDistribution(gyms), [gyms])

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-6 shadow-premium"
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="size-6" />
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground">
            Welcome back, {session?.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">Platform control center · {today}</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiStats.map(({ key, ...stat }, i) => (
          <StatCard key={key} {...stat} icon={STAT_ICONS[key]} index={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueTrendChart
            data={revenueTrend}
            title="Platform revenue"
            description="Monthly recurring revenue over the last 8 months"
          />
        </div>
        <PlanMixChart
          data={planDistribution}
          title="Gyms by plan"
          description="Subscription mix across all gyms"
          centerLabel="Total gyms"
          unitLabel="gyms"
        />
      </div>

      <RecentGyms gyms={gyms} />
    </div>
  )
}
