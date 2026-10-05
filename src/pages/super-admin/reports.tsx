import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Building2, CheckCircle2, Ban, Wallet, Download } from "lucide-react"
import { getAllGyms } from "@/lib/gyms"
import { getGymStatus } from "@/lib/gym-status"
import { computeRevenueBreakdown } from "@/lib/revenue"
import { exportRowsToExcel } from "@/lib/excel"
import { formatCurrency, formatNumber } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { ReportTypeCard } from "@/components/reports/report-type-card"
import { ReportPreviewTable, type ReportColumn } from "@/components/reports/report-preview-table"
import type { Gym } from "@/types"

type ReportKey = "all" | "active" | "suspended" | "revenue"

const GYM_COLUMNS: ReportColumn[] = [
  { key: "gym", label: "Gym" },
  { key: "owner", label: "Owner" },
  { key: "plan", label: "Plan" },
  { key: "members", label: "Members", align: "right" },
  { key: "status", label: "Status" },
  { key: "subscriptionEnd", label: "Subscription End" },
]

const REVENUE_COLUMNS: ReportColumn[] = [
  { key: "plan", label: "Plan" },
  { key: "gyms", label: "Gyms", align: "right" },
  { key: "revenue", label: "Revenue", align: "right" },
  { key: "share", label: "Share of MRR", align: "right" },
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function filterGyms(gyms: Gym[], key: ReportKey): Gym[] {
  if (key === "active") return gyms.filter((g) => ["active", "renewal-due"].includes(getGymStatus(g)))
  if (key === "suspended") return gyms.filter((g) => ["suspended", "expired"].includes(getGymStatus(g)))
  return gyms
}

function toGymRows(gyms: Gym[]) {
  return gyms.map((g) => ({
    gym: g.name,
    owner: g.ownerName,
    plan: g.plan,
    members: formatNumber(g.memberCount),
    status: getGymStatus(g),
    subscriptionEnd: formatDate(g.subscriptionEndDate),
  }))
}

export default function SuperAdminReportsPage() {
  const [gyms, setGyms] = useState<Gym[]>([])
  const [selected, setSelected] = useState<ReportKey>("all")

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

  const revenueRows = useMemo(() => computeRevenueBreakdown(gyms), [gyms])

  const isRevenue = selected === "revenue"
  const filteredGyms = useMemo(() => filterGyms(gyms, selected), [gyms, selected])

  const columns = isRevenue ? REVENUE_COLUMNS : GYM_COLUMNS
  const rows = isRevenue
    ? (() => {
        const total = revenueRows.reduce((sum, r) => sum + r.revenue, 0)
        return revenueRows.map((r) => ({
          plan: r.label,
          gyms: formatNumber(r.gymCount),
          revenue: formatCurrency(r.revenue),
          share: total > 0 ? `${((r.revenue / total) * 100).toFixed(0)}%` : "0%",
        }))
      })()
    : toGymRows(filteredGyms)

  function handleExport() {
    void exportRowsToExcel(rows, `gymsos-${selected}-report`, "Report")
  }

  return (
    <div className="flex flex-col gap-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">Platform-wide gym and revenue reports</p>
        </div>
        <Button size="sm" onClick={handleExport}>
          <Download className="size-3.5" />
          Export Excel
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportTypeCard
          icon={Building2}
          label="All Gyms"
          count={gyms.length}
          active={selected === "all"}
          onClick={() => setSelected("all")}
        />
        <ReportTypeCard
          icon={CheckCircle2}
          label="Active Subscriptions"
          count={filterGyms(gyms, "active").length}
          active={selected === "active"}
          onClick={() => setSelected("active")}
        />
        <ReportTypeCard
          icon={Ban}
          label="Suspended / Expired"
          count={filterGyms(gyms, "suspended").length}
          active={selected === "suspended"}
          onClick={() => setSelected("suspended")}
        />
        <ReportTypeCard
          icon={Wallet}
          label="Revenue by Plan"
          count={revenueRows.length}
          active={selected === "revenue"}
          onClick={() => setSelected("revenue")}
        />
      </div>

      <ReportPreviewTable columns={columns} rows={rows} />
    </div>
  )
}
