import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Users, UserCheck, CalendarClock, AlertCircle, Download, Printer } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useMembers } from "@/hooks/use-members"
import { useGymPlan } from "@/hooks/use-gym-plan"
import { Button } from "@/components/ui/button"
import { ReportTypeCard } from "@/components/reports/report-type-card"
import { ReportPreviewTable, type ReportColumn } from "@/components/reports/report-preview-table"
import { PlanUpgradeNotice } from "@/components/shared/plan-upgrade-notice"
import { getMemberStatus } from "@/lib/member-status"
import { exportRowsToExcel } from "@/lib/excel"
import { formatCurrency } from "@/lib/format"
import { minPlanFor, PLAN_LABEL } from "@/lib/plan-features"
import type { Member } from "@/types"

type ReportKey = "all" | "active" | "expiring" | "pending"

const REPORT_DEFS: { key: ReportKey; label: string; icon: typeof Users }[] = [
  { key: "all", label: "All Members", icon: Users },
  { key: "active", label: "Active Members", icon: UserCheck },
  { key: "expiring", label: "Expiring Soon", icon: CalendarClock },
  { key: "pending", label: "Payment Pending", icon: AlertCircle },
]

const COLUMNS: ReportColumn[] = [
  { key: "name", label: "Name" },
  { key: "contact", label: "Contact" },
  { key: "plan", label: "Plan" },
  { key: "type", label: "Type" },
  { key: "amount", label: "Amount", align: "right" },
  { key: "balance", label: "Balance", align: "right" },
  { key: "status", label: "Status" },
]

function filterByReport(members: Member[], key: ReportKey): Member[] {
  switch (key) {
    case "active":
      return members.filter((m) => getMemberStatus(m) === "active")
    case "expiring":
      return members.filter((m) => getMemberStatus(m) === "expiring")
    case "pending":
      return members.filter((m) => m.balanceAmount > 0)
    default:
      return members
  }
}

function toRows(members: Member[]) {
  return members.map((m) => ({
    name: m.name,
    contact: m.contactNumber,
    plan: m.plan,
    type: m.memberType === "new" ? "New" : "Renewal",
    amount: formatCurrency(m.paidAmount),
    balance: formatCurrency(m.balanceAmount),
    status: getMemberStatus(m),
  }))
}

export default function GymOwnerReportsPage() {
  const { session } = useAuth()
  const gymId = session?.gymId ?? ""
  const { members } = useMembers(gymId)
  const { features } = useGymPlan()
  const [selected, setSelected] = useState<ReportKey>("all")

  const filteredMembers = useMemo(() => filterByReport(members, selected), [members, selected])
  const rows = useMemo(() => toRows(filteredMembers), [filteredMembers])

  function handleExport() {
    void exportRowsToExcel(rows, `${session?.gymName ?? "gym"}-${selected}-report`, "Report")
  }

  function handlePrint() {
    window.print()
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
          <p className="text-sm text-muted-foreground">Generate and export member reports</p>
        </div>
        {features.reports && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="size-3.5" />
              Print
            </Button>
            <Button size="sm" onClick={handleExport}>
              <Download className="size-3.5" />
              Export Excel
            </Button>
          </div>
        )}
      </motion.div>

      {features.reports ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {REPORT_DEFS.map((def) => (
              <ReportTypeCard
                key={def.key}
                icon={def.icon}
                label={def.label}
                count={filterByReport(members, def.key).length}
                active={selected === def.key}
                onClick={() => setSelected(def.key)}
              />
            ))}
          </div>

          <ReportPreviewTable columns={COLUMNS} rows={rows} />
        </>
      ) : (
        <PlanUpgradeNotice
          title="Reports aren't available on your plan"
          description="Upgrade your gym's plan to generate and export member reports — active members, expiring memberships, and pending payments, all in one place."
          requiredPlanLabel={PLAN_LABEL[minPlanFor("reports")]}
        />
      )}
    </div>
  )
}
