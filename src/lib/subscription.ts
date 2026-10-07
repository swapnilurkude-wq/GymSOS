import { gymToFormValues } from "@/lib/gym-defaults"
import type { Gym, GymFormValues, GymPlan } from "@/types"

/**
 * Renewal is fully manual: the admin chooses the new
 * date — nothing is added or calculated automatically.
 */
export function renewSubscriptionValues(gym: Gym, newEndDate: string): GymFormValues {
  return {
    ...gymToFormValues(gym),
    status: "active",
    subscriptionEndDate: new Date(newEndDate).toISOString(),
  }
}

export function changePlanValues(gym: Gym, plan: GymPlan): GymFormValues {
  return { ...gymToFormValues(gym), plan }
}

export function toggleSuspendValues(gym: Gym): GymFormValues {
  return {
    ...gymToFormValues(gym),
    status: gym.status === "suspended" ? "active" : "suspended",
  }
}
