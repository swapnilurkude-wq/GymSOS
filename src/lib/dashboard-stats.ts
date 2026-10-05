import { getMemberStatus } from "@/lib/member-status"
import { isSameDay, isSameMonth } from "@/lib/payments"
import { PLAN_DURATION_MONTHS } from "@/types"
import type { Member } from "@/types"
import type { StatDef, RevenuePoint, PlanMixSlice, RecentMemberRow } from "@/data/dashboard-mock"

const DAY_MS = 1000 * 60 * 60 * 24

function daysBetween(iso: string, ref: Date): number {
  return Math.ceil((new Date(iso).getTime() - ref.getTime()) / DAY_MS)
}

export function pctChange(from: number, to: number): number {
  if (from === 0) return to === 0 ? 0 : 100
  return ((to - from) / from) * 100
}

export function lastNDays(n: number, now: Date): Date[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (n - 1 - i))
    return d
  })
}

export function lastNMonths(n: number, now: Date): { year: number; month: number; label: string }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)
    return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("en-IN", { month: "short" }) }
  })
}

function trendOverDays(days: Date[], fn: (asOf: Date) => number): number[] {
  return days.map(fn)
}

export function computeGymKpiStats(members: Member[]): StatDef[] {
  const now = new Date()
  const days = lastNDays(7, now)

  const totalMembers = members.length
  const activeMembers = members.filter((m) => getMemberStatus(m) === "active").length
  const { todayCollection, monthCollection } = computeTodayAndMonthCollection(members, now)
  const pendingMembers = members.filter((m) => m.balanceAmount > 0)
  const totalOutstanding = pendingMembers.reduce((sum, m) => sum + m.balanceAmount, 0)
  const renewalDue = members.filter((m) => {
    const d = daysBetween(m.endDate, now)
    return d >= 0 && d <= 30
  })
  const dueWithin7 = renewalDue.filter((m) => daysBetween(m.endDate, now) <= 7).length
  const expiringMembers = members.filter((m) => getMemberStatus(m) === "expiring").length
  const newSignups = members.filter((m) => {
    const d = daysBetween(m.createdAt, now)
    return d <= 0 && d >= -7
  }).length

  const totalTrend = trendOverDays(days, (asOf) =>
    members.filter((m) => daysBetween(m.createdAt, asOf) <= 0).length
  )
  const activeTrend = trendOverDays(days, (asOf) =>
    members.filter((m) => daysBetween(m.createdAt, asOf) <= 0 && getMemberStatus(m) !== "expired").length
  )
  const todayTrend = trendOverDays(days, (asOf) =>
    members.reduce((sum, m) => sum + (isSameDay(m.paymentDate, asOf) ? m.paidAmount : 0), 0)
  )
  const monthTrend = lastNMonths(8, now).map(({ year, month }) =>
    members.reduce((sum, m) => {
      const d = new Date(m.paymentDate)
      return sum + (d.getFullYear() === year && d.getMonth() === month ? m.paidAmount : 0)
    }, 0)
  )
  const newSignupsTrend = trendOverDays(days, (asOf) =>
    members.filter((m) => {
      const d = daysBetween(m.createdAt, asOf)
      return d <= 0 && d >= -7
    }).length
  )
  const renewalTrend = trendOverDays(days, (asOf) =>
    members.filter((m) => {
      const d = daysBetween(m.endDate, asOf)
      return d >= 0 && d <= 30
    }).length
  )
  const expiringTrend = trendOverDays(days, (asOf) =>
    members.filter((m) => {
      const d = daysBetween(m.endDate, asOf)
      return d >= 0 && d <= 7
    }).length
  )

  return [
    {
      key: "total-members",
      label: "Total Members",
      value: totalMembers,
      format: "number",
      delta: pctChange(totalTrend[0], totalTrend[totalTrend.length - 1]),
      deltaGoodDirection: "up",
      context: "vs last week",
      sparkline: totalTrend,
      tone: "brand",
    },
    {
      key: "active-members",
      label: "Active Members",
      value: activeMembers,
      format: "number",
      delta: pctChange(activeTrend[0], activeTrend[activeTrend.length - 1]),
      deltaGoodDirection: "up",
      context: totalMembers > 0 ? `${((activeMembers / totalMembers) * 100).toFixed(1)}% of total members` : "no members yet",
      sparkline: activeTrend,
      tone: "success",
    },
    {
      key: "today-collection",
      label: "Today's Collection",
      value: todayCollection,
      format: "currency",
      delta: pctChange(todayTrend[todayTrend.length - 2] ?? 0, todayCollection),
      deltaGoodDirection: "up",
      context: "vs yesterday",
      sparkline: todayTrend,
      tone: "success",
    },
    {
      key: "monthly-revenue",
      label: "Monthly Revenue",
      value: monthCollection,
      format: "currency",
      delta: pctChange(monthTrend[monthTrend.length - 2] ?? 0, monthCollection),
      deltaGoodDirection: "up",
      context: "vs last month",
      sparkline: monthTrend,
      tone: "brand",
    },
    {
      key: "new-signups",
      label: "New Signups",
      value: newSignups,
      format: "number",
      delta: pctChange(newSignupsTrend[0], newSignupsTrend[newSignupsTrend.length - 1]),
      deltaGoodDirection: "up",
      context: "this week",
      sparkline: newSignupsTrend,
      tone: "success",
    },
    {
      key: "renewal-due",
      label: "Renewal Due",
      value: renewalDue.length,
      format: "number",
      delta: pctChange(renewalTrend[0], renewalTrend[renewalTrend.length - 1]),
      deltaGoodDirection: "down",
      context: `${dueWithin7} due within 7 days`,
      sparkline: renewalTrend,
      tone: "warning",
    },
    {
      key: "pending-payments",
      label: "Pending Payments",
      value: totalOutstanding,
      format: "currency",
      delta: 0,
      deltaGoodDirection: "down",
      context: `across ${pendingMembers.length} member${pendingMembers.length === 1 ? "" : "s"}`,
      sparkline: Array(7).fill(totalOutstanding),
      tone: "danger",
    },
    {
      key: "expiring-members",
      label: "Expiring Members",
      value: expiringMembers,
      format: "number",
      delta: pctChange(expiringTrend[0], expiringTrend[expiringTrend.length - 1]),
      deltaGoodDirection: "down",
      context: "within the next 7 days",
      sparkline: expiringTrend,
      tone: "warning",
    },
  ]
}

function computeTodayAndMonthCollection(members: Member[], now: Date) {
  return members.reduce(
    (acc, m) => ({
      todayCollection: acc.todayCollection + (isSameDay(m.paymentDate, now) ? m.paidAmount : 0),
      monthCollection: acc.monthCollection + (isSameMonth(m.paymentDate, now) ? m.paidAmount : 0),
    }),
    { todayCollection: 0, monthCollection: 0 }
  )
}

export function computeGymRevenueTrend(members: Member[]): RevenuePoint[] {
  const now = new Date()
  return lastNMonths(8, now).map(({ year, month, label }) => ({
    label,
    revenue: members.reduce((sum, m) => {
      const d = new Date(m.paymentDate)
      return sum + (d.getFullYear() === year && d.getMonth() === month ? m.paidAmount : 0)
    }, 0),
  }))
}

const PLAN_ORDER = Object.keys(PLAN_DURATION_MONTHS) as (keyof typeof PLAN_DURATION_MONTHS)[]

export function computeGymPlanMix(members: Member[]): PlanMixSlice[] {
  return PLAN_ORDER.map((plan) => ({
    name: plan,
    value: members.filter((m) => m.plan === plan).length,
  }))
}

export function computeRecentMembers(members: Member[], limit = 6): RecentMemberRow[] {
  return [...members]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit)
    .map((m) => ({
      id: m.id,
      name: m.name,
      initials: m.name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2),
      plan: m.plan,
      type: m.memberType === "new" ? "New" : "Renewal",
      amount: m.paidAmount,
      status: getMemberStatus(m),
      date: m.paymentDate,
    }))
}
