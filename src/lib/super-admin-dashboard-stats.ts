import { getGymStatus, type GymDisplayStatus } from "@/lib/gym-status"
import { isPaying } from "@/lib/revenue"
import { pctChange, lastNDays, lastNMonths } from "@/lib/dashboard-stats"
import { GYM_PLAN_FEE } from "@/types"
import type { Gym, GymPlan } from "@/types"
import type { StatDef, RevenuePoint, PlanMixSlice } from "@/data/dashboard-mock"

const DAY_MS = 1000 * 60 * 60 * 24

function daysBetween(iso: string, ref: Date): number {
  return Math.ceil((new Date(iso).getTime() - ref.getTime()) / DAY_MS)
}

function getGymStatusAsOf(gym: Gym, asOf: Date): GymDisplayStatus {
  if (gym.status === "suspended") return "suspended"
  const daysToEnd = daysBetween(gym.subscriptionEndDate, asOf)
  if (daysToEnd < 0) return "expired"
  if (daysToEnd <= 14) return "renewal-due"
  return "active"
}

function isPayingAsOf(gym: Gym, asOf: Date): boolean {
  const status = getGymStatusAsOf(gym, asOf)
  return status === "active" || status === "renewal-due"
}

export function computePlatformKpiStats(gyms: Gym[]): StatDef[] {
  const now = new Date()
  const days = lastNDays(7, now)

  const totalGyms = gyms.length
  const activeGyms = gyms.filter((g) => getGymStatus(g) === "active").length
  const payingGyms = gyms.filter(isPaying)
  const mrr = payingGyms.reduce((sum, g) => sum + GYM_PLAN_FEE[g.plan], 0)
  const renewalDueGyms = gyms.filter((g) => getGymStatus(g) === "renewal-due")
  const dueWithin7 = renewalDueGyms.filter((g) => daysBetween(g.subscriptionEndDate, now) <= 7).length
  const atRiskGyms = gyms.filter((g) => g.status === "suspended" || getGymStatus(g) === "expired").length
  const newSignups = gyms.filter((g) => {
    const d = daysBetween(g.createdAt, now)
    return d <= 0 && d >= -7
  }).length

  const signedUpBy = (asOf: Date) => (g: Gym) => daysBetween(g.createdAt, asOf) <= 0

  const totalTrend = days.map((asOf) => gyms.filter(signedUpBy(asOf)).length)
  const activeTrend = days.map(
    (asOf) => gyms.filter((g) => signedUpBy(asOf)(g) && getGymStatusAsOf(g, asOf) === "active").length
  )
  const payingTrend = days.map((asOf) => gyms.filter((g) => signedUpBy(asOf)(g) && isPayingAsOf(g, asOf)).length)
  const renewalTrend = days.map(
    (asOf) => gyms.filter((g) => signedUpBy(asOf)(g) && getGymStatusAsOf(g, asOf) === "renewal-due").length
  )
  const newSignupsTrend = days.map(
    (asOf) =>
      gyms.filter((g) => {
        const d = daysBetween(g.createdAt, asOf)
        return d <= 0 && d >= -7
      }).length
  )
  const atRiskTrend = days.map(
    (asOf) =>
      gyms.filter(
        (g) => signedUpBy(asOf)(g) && (g.status === "suspended" || getGymStatusAsOf(g, asOf) === "expired")
      ).length
  )
  const mrrTrend = lastNMonths(8, now).map(({ year, month }) => {
    const monthEnd = new Date(year, month + 1, 0)
    return gyms
      .filter((g) => new Date(g.createdAt) <= monthEnd && isPaying(g))
      .reduce((sum, g) => sum + GYM_PLAN_FEE[g.plan], 0)
  })

  return [
    {
      key: "total-gyms",
      label: "Total Gyms",
      value: totalGyms,
      format: "number",
      delta: pctChange(totalTrend[0], totalTrend[totalTrend.length - 1]),
      deltaGoodDirection: "up",
      context: "vs last week",
      sparkline: totalTrend,
      tone: "brand",
    },
    {
      key: "active-gyms",
      label: "Active Gyms",
      value: activeGyms,
      format: "number",
      delta: pctChange(activeTrend[0], activeTrend[activeTrend.length - 1]),
      deltaGoodDirection: "up",
      context: totalGyms > 0 ? `${((activeGyms / totalGyms) * 100).toFixed(1)}% of total gyms` : "no gyms yet",
      sparkline: activeTrend,
      tone: "success",
    },
    {
      key: "mrr",
      label: "Monthly Recurring Revenue",
      value: mrr,
      format: "currency",
      delta: pctChange(mrrTrend[mrrTrend.length - 2] ?? 0, mrr),
      deltaGoodDirection: "up",
      context: "vs last month",
      sparkline: mrrTrend,
      tone: "brand",
    },
    {
      key: "active-subscriptions",
      label: "Active Subscriptions",
      value: payingGyms.length,
      format: "number",
      delta: pctChange(payingTrend[0], payingTrend[payingTrend.length - 1]),
      deltaGoodDirection: "up",
      context: "across all plans",
      sparkline: payingTrend,
      tone: "success",
    },
    {
      key: "expiring-subscriptions",
      label: "Expiring Subscriptions",
      value: renewalDueGyms.length,
      format: "number",
      delta: pctChange(renewalTrend[0], renewalTrend[renewalTrend.length - 1]),
      deltaGoodDirection: "down",
      context: `${dueWithin7} due within 7 days`,
      sparkline: renewalTrend,
      tone: "warning",
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
      tone: "brand",
    },
    {
      key: "at-risk-gyms",
      label: "At-Risk Gyms",
      value: atRiskGyms,
      format: "number",
      delta: pctChange(atRiskTrend[0], atRiskTrend[atRiskTrend.length - 1]),
      deltaGoodDirection: "down",
      context: "suspended or overdue",
      sparkline: atRiskTrend,
      tone: "danger",
    },
  ]
}

export function computePlatformRevenueTrend(gyms: Gym[]): RevenuePoint[] {
  const now = new Date()
  return lastNMonths(8, now).map(({ year, month, label }) => {
    const monthEnd = new Date(year, month + 1, 0)
    return {
      label,
      revenue: gyms
        .filter((g) => new Date(g.createdAt) <= monthEnd && isPaying(g))
        .reduce((sum, g) => sum + GYM_PLAN_FEE[g.plan], 0),
    }
  })
}

const PLAN_ORDER: GymPlan[] = ["trial", "starter", "growth", "pro"]
const PLAN_LABEL: Record<GymPlan, string> = {
  trial: "Trial",
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
}

export function computeGymPlanDistribution(gyms: Gym[]): PlanMixSlice[] {
  return PLAN_ORDER.map((plan) => ({
    name: PLAN_LABEL[plan],
    value: gyms.filter((g) => g.plan === plan).length,
  }))
}
