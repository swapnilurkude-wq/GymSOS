import type { MemberStatus } from "@/lib/member-status"

export interface StatDef {
  key: string
  label: string
  value: number
  format: "number" | "currency"
  delta: number
  deltaGoodDirection: "up" | "down"
  context: string
  sparkline: number[]
  tone: "brand" | "success" | "warning" | "danger"
}

export interface RevenuePoint {
  label: string
  revenue: number
}

export interface PlanMixSlice {
  name: string
  value: number
}

export interface RecentMemberRow {
  id: string
  name: string
  initials: string
  plan: string
  type: "New" | "Renewal"
  amount: number
  status: MemberStatus
  date: string
}
