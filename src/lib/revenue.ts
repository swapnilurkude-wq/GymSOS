import { getGymStatus } from "@/lib/gym-status"
import { GYM_PLAN_FEE } from "@/types"
import type { Gym, GymPlan } from "@/types"

export interface PlanRevenueRow {
  plan: GymPlan
  label: string
  gymCount: number
  revenue: number
}

const PLAN_ORDER: GymPlan[] = ["trial", "starter", "growth", "pro"]
const PLAN_LABEL: Record<GymPlan, string> = {
  trial: "Trial",
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
}

export function isPaying(gym: Gym): boolean {
  const status = getGymStatus(gym)
  return status === "active" || status === "renewal-due"
}

export function computeRevenueBreakdown(gyms: Gym[]): PlanRevenueRow[] {
  return PLAN_ORDER.map((plan) => {
    const planGyms = gyms.filter((g) => g.plan === plan && isPaying(g))
    return {
      plan,
      label: PLAN_LABEL[plan],
      gymCount: planGyms.length,
      revenue: planGyms.length * GYM_PLAN_FEE[plan],
    }
  })
}

export interface RevenueSummary {
  mrr: number
  arr: number
  payingGymCount: number
  avgPerGym: number
}

export function computeRevenueSummary(gyms: Gym[]): RevenueSummary {
  const paying = gyms.filter(isPaying)
  const mrr = paying.reduce((sum, g) => sum + GYM_PLAN_FEE[g.plan], 0)
  return {
    mrr,
    arr: mrr * 12,
    payingGymCount: paying.length,
    avgPerGym: paying.length > 0 ? mrr / paying.length : 0,
  }
}
