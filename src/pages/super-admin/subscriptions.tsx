import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { CheckCircle2, CreditCard, Wallet, CalendarClock, Ban, X } from "lucide-react"
import { useGyms } from "@/hooks/use-gyms"
import { DataErrorBanner } from "@/components/shared/data-error-banner"
import { StatCard } from "@/components/shared/stat-card"
import { SubscriptionToolbar } from "@/components/subscriptions/subscription-toolbar"
import { SubscriptionTable } from "@/components/subscriptions/subscription-table"
import { ChangePlanDialog } from "@/components/subscriptions/change-plan-dialog"
import type { GymFilters } from "@/components/gyms/gym-toolbar"
import { getGymStatus } from "@/lib/gym-status"
import { renewSubscriptionValues, changePlanValues, toggleSuspendValues } from "@/lib/subscription"
import { GYM_PLAN_FEE } from "@/types"
import type { Gym, GymPlan } from "@/types"

const DEFAULT_FILTERS: GymFilters = { search: "", status: "all", plan: "all" }

export default function SubscriptionManagementPage() {
  const { gyms, error, refresh, editGym } = useGyms()

  const [filters, setFilters] = useState<GymFilters>(DEFAULT_FILTERS)
  const [changePlanTarget, setChangePlanTarget] = useState<Gym | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  const metrics = useMemo(() => {
    const active = gyms.filter((g) => getGymStatus(g) === "active" || getGymStatus(g) === "renewal-due")
    const mrr = active.reduce((sum, g) => sum + GYM_PLAN_FEE[g.plan], 0)
    const renewalsDue = gyms.filter((g) => getGymStatus(g) === "renewal-due").length
    const atRisk = gyms.filter((g) => {
      const s = getGymStatus(g)
      return s === "expired" || s === "suspended"
    }).length

    return { activeCount: active.length, mrr, renewalsDue, atRisk }
  }, [gyms])

  const filteredGyms = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    return gyms.filter((g) => {
      if (query) {
        const haystack = `${g.name} ${g.ownerName}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      if (filters.status !== "all" && getGymStatus(g) !== filters.status) return false
      if (filters.plan !== "all" && g.plan !== filters.plan) return false
      return true
    })
  }, [gyms, filters])

  async function handleRenew(gym: Gym) {
    await editGym(gym.id, renewSubscriptionValues(gym))
    setBanner(`${gym.name}'s subscription was renewed for another month.`)
  }

  async function handleToggleSuspend(gym: Gym) {
    await editGym(gym.id, toggleSuspendValues(gym))
    setBanner(
      gym.status === "suspended" ? `${gym.name}'s account was reactivated.` : `${gym.name}'s account was suspended.`
    )
  }

  async function handleChangePlanConfirm(plan: GymPlan) {
    if (!changePlanTarget) return
    await editGym(changePlanTarget.id, changePlanValues(changePlanTarget, plan))
    setBanner(`${changePlanTarget.name} was moved to the ${plan} plan.`)
    setChangePlanTarget(null)
  }

  return (
    <div className="flex flex-col gap-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1"
      >
        <h1 className="font-display text-xl font-semibold text-foreground">Subscription Management</h1>
        <p className="text-sm text-muted-foreground">Billing, plans & renewals across every gym</p>
      </motion.div>

      <DataErrorBanner error={error} onRetry={refresh} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CreditCard} label="Active Subscriptions" value={metrics.activeCount} tone="brand" />
        <StatCard icon={Wallet} label="Monthly Recurring Revenue" value={metrics.mrr} format="currency" tone="success" />
        <StatCard icon={CalendarClock} label="Renewals Due" value={metrics.renewalsDue} tone="warning" />
        <StatCard icon={Ban} label="Suspended / Expired" value={metrics.atRisk} tone="danger" />
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

      <SubscriptionToolbar filters={filters} onFiltersChange={setFilters} />

      <SubscriptionTable
        gyms={filteredGyms}
        onRenew={handleRenew}
        onChangePlan={setChangePlanTarget}
        onToggleSuspend={handleToggleSuspend}
      />

      <ChangePlanDialog
        gym={changePlanTarget}
        onOpenChange={(open) => !open && setChangePlanTarget(null)}
        onConfirm={handleChangePlanConfirm}
      />
    </div>
  )
}
