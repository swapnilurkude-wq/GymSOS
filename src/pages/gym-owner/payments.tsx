import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Wallet, CalendarDays, AlertCircle, CheckCircle2, TrendingUp, X } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useMembers } from "@/hooks/use-members"
import { DataErrorBanner } from "@/components/shared/data-error-banner"
import { StatCard } from "@/components/shared/stat-card"
import { PaymentToolbar, type PaymentFilters } from "@/components/payments/payment-toolbar"
import { PaymentTable } from "@/components/payments/payment-table"
import { CollectPaymentDialog } from "@/components/payments/collect-payment-dialog"
import {
  computePaymentSummary,
  recordPaymentValues,
  isSameDay,
  isSameMonth,
  isWithinLastDays,
  type CollectionMode,
} from "@/lib/payments"
import { formatCompactCurrency } from "@/lib/format"
import type { Member } from "@/types"

const DEFAULT_FILTERS: PaymentFilters = { search: "", mode: "all", range: "all" }

export default function PaymentsPage() {
  const { session } = useAuth()
  const gymId = session?.gymId ?? ""
  const { members, error: membersError, refresh: refreshMembers, editMember } = useMembers(gymId)

  const [filters, setFilters] = useState<PaymentFilters>(DEFAULT_FILTERS)
  const [collectTarget, setCollectTarget] = useState<Member | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  const summary = useMemo(() => computePaymentSummary(members), [members])

  const filteredMembers = useMemo(() => {
    const now = new Date()
    const query = filters.search.trim().toLowerCase()

    return members
      .filter((m) => {
        if (query) {
          const haystack = `${m.name} ${m.receiptNumber}`.toLowerCase()
          if (!haystack.includes(query)) return false
        }
        if (filters.mode !== "all" && m.paymentMode !== filters.mode) return false
        if (filters.range === "today" && !isSameDay(m.paymentDate, now)) return false
        if (filters.range === "week" && !isWithinLastDays(m.paymentDate, 7, now)) return false
        if (filters.range === "month" && !isSameMonth(m.paymentDate, now)) return false
        return true
      })
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
  }, [members, filters])

  async function handleCollectConfirm(amount: number, mode: CollectionMode, receiver: string) {
    if (!collectTarget) return
    await editMember(collectTarget.id, recordPaymentValues(collectTarget, amount, mode, receiver))
    setBanner(`Collected ${formatCompactCurrency(amount)} from ${collectTarget.name}.`)
    setCollectTarget(null)
  }

  return (
    <div className="flex flex-col gap-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1"
      >
        <h1 className="font-display text-xl font-semibold text-foreground">Payments</h1>
        <p className="text-sm text-muted-foreground">Collections and outstanding balances</p>
      </motion.div>

      <DataErrorBanner error={membersError} onRetry={refreshMembers} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Today's Collection" value={summary.todayCollection} format="currency" tone="success" />
        <StatCard icon={CalendarDays} label="This Month" value={summary.monthCollection} format="currency" tone="brand" />
        <StatCard icon={AlertCircle} label="Outstanding Balance" value={summary.totalOutstanding} format="currency" tone="warning" />
        <StatCard icon={TrendingUp} label="Total Collected" value={summary.totalCollected} format="currency" tone="brand" />
      </div>

      {banner && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            {banner}
          </div>
          <button onClick={() => setBanner(null)} aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      )}

      <PaymentToolbar filters={filters} onFiltersChange={setFilters} />

      <PaymentTable members={filteredMembers} onCollect={setCollectTarget} />

      <CollectPaymentDialog
        member={collectTarget}
        onOpenChange={(open) => !open && setCollectTarget(null)}
        onConfirm={handleCollectConfirm}
      />
    </div>
  )
}
