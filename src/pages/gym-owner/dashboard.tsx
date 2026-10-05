import { useMemo } from "react"
import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import {
  Users,
  UserCheck,
  Wallet,
  TrendingUp,
  CalendarClock,
  Receipt,
  AlertTriangle,
  UserPlus,
  type LucideIcon,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useMembers } from "@/hooks/use-members"
import { useReceipts } from "@/hooks/use-receipts"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/shared/stat-card"
import { RevenueTrendChart } from "@/components/dashboard/revenue-trend-chart"
import { PlanMixChart } from "@/components/dashboard/plan-mix-chart"
import { RecentMembers } from "@/components/dashboard/recent-members"
import { RecentReceipts } from "@/components/dashboard/recent-receipts"
import { getReceiptTemplate } from "@/lib/receipt-template"
import { downloadReceiptDocumentPdf } from "@/lib/receipt-pdf"
import {
  computeGymKpiStats,
  computeGymRevenueTrend,
  computeGymPlanMix,
  computeRecentMembers,
} from "@/lib/dashboard-stats"

const STAT_ICONS: Record<string, LucideIcon> = {
  "total-members": Users,
  "active-members": UserCheck,
  "today-collection": Wallet,
  "monthly-revenue": TrendingUp,
  "new-signups": UserPlus,
  "renewal-due": CalendarClock,
  "pending-payments": Receipt,
  "expiring-members": AlertTriangle,
}

export default function GymOwnerDashboard() {
  const { session } = useAuth()
  const gymId = session?.gymId ?? ""
  const { members } = useMembers(gymId)
  const { receipts } = useReceipts(gymId)
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  const kpiStats = useMemo(() => computeGymKpiStats(members), [members])
  const revenueTrend = useMemo(() => computeGymRevenueTrend(members), [members])
  const planMix = useMemo(() => computeGymPlanMix(members), [members])
  const recentMembers = useMemo(() => computeRecentMembers(members), [members])
  const recentReceipts = useMemo(
    () => [...receipts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6),
    [receipts]
  )

  async function handleDownloadReceipt(receipt: (typeof recentReceipts)[number]) {
    const template = await getReceiptTemplate(gymId)
    if (template) void downloadReceiptDocumentPdf(receipt, template)
  }

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-6 shadow-premium sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground">
            Welcome back, {session?.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">
            {session?.gymName} · {today}
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/gym-owner/members">
            <UserPlus className="size-4" />
            Add Member
          </Link>
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiStats.map(({ key, ...stat }, i) => (
          <StatCard key={key} {...stat} icon={STAT_ICONS[key]} index={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueTrendChart data={revenueTrend} />
        </div>
        <PlanMixChart data={planMix} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentMembers rows={recentMembers} />
        <RecentReceipts receipts={recentReceipts} onDownload={handleDownloadReceipt} />
      </div>
    </div>
  )
}
