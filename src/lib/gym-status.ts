import type { Gym } from "@/types"

export type GymDisplayStatus = "active" | "renewal-due" | "expired" | "suspended"

const DAY_MS = 1000 * 60 * 60 * 24

export function getGymStatus(gym: Gym): GymDisplayStatus {
  if (gym.status === "suspended") return "suspended"

  const now = Date.now()
  const end = new Date(gym.subscriptionEndDate).getTime()

  if (end < now) return "expired"
  if (end - now <= 14 * DAY_MS) return "renewal-due"
  return "active"
}

export const GYM_STATUS_META: Record<
  GymDisplayStatus,
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  active: { label: "Active", variant: "success" },
  "renewal-due": { label: "Renewal due", variant: "warning" },
  expired: { label: "Expired", variant: "destructive" },
  suspended: { label: "Suspended", variant: "destructive" },
}
