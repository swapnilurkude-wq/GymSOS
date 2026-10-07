import type { GymPlan } from "@/types"

export interface PlanFeatures {
  maxMembers: number | null
  excelExport: boolean
  excelImport: boolean
  pdfReceipts: boolean
  reports: boolean
}

export const PLAN_LABEL: Record<GymPlan, string> = {
  trial: "Trial",
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
}

export const PLAN_FEATURES: Record<GymPlan, PlanFeatures> = {
  trial: {
    maxMembers: 10,
    excelExport: false,
    excelImport: false,
    pdfReceipts: false,
    reports: false,
  },
  starter: {
    maxMembers: 100,
    excelExport: true,
    excelImport: false,
    pdfReceipts: true,
    reports: false,
  },
  growth: {
    maxMembers: 300,
    excelExport: true,
    excelImport: true,
    pdfReceipts: true,
    reports: true,
  },
  pro: {
    maxMembers: null,
    excelExport: true,
    excelImport: true,
    pdfReceipts: true,
    reports: true,
  },
}

export function getPlanFeatures(plan: GymPlan): PlanFeatures {
  return PLAN_FEATURES[plan]
}

export function minPlanFor(feature: keyof Omit<PlanFeatures, "maxMembers">): GymPlan {
  const order: GymPlan[] = ["trial", "starter", "growth", "pro"]
  return order.find((plan) => PLAN_FEATURES[plan][feature]) ?? "pro"
}
