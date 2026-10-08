import type { Gym } from "@/types"

export type GymDisplayStatus = "active" | "renewal-due" | "expired" | "suspended"

export type TrialState = "trial-active" | "paid" | "expired"

const DAY_MS = 1000 * 60 * 60 * 24

/**
 * Authoritative trial state for a gym, derived from the
 * gym row stored in the database — never from the device
 * clock or local state. `subscription_end_date` is the
 * trial end for trial gyms and is only ever written by
 * the server (signup Edge Function / Super Admin).
 *
 * "paid" means "not a trial gym" — paid plans are
 * unaffected by the trial gate, exactly as before.
 */
export function getTrialState(gym: Gym): TrialState {
  if (gym.plan !== "trial") return "paid"
  return new Date(gym.subscriptionEndDate).getTime() > Date.now()
    ? "trial-active"
    : "expired"
}

/** Whole days left on a live trial (0 once expired). */
export function trialDaysRemaining(gym: Gym): number {
  const remaining = Math.ceil(
    (new Date(gym.subscriptionEndDate).getTime() - Date.now()) / DAY_MS
  )
  return Math.max(0, remaining)
}

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
