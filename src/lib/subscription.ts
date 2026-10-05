import { gymToFormValues } from "@/lib/gym-defaults"
import type { Gym, GymFormValues, GymPlan } from "@/types"

export function renewSubscriptionValues(gym: Gym): GymFormValues {
  const base = new Date(gym.subscriptionEndDate)
  const now = new Date()
  const start = base.getTime() > now.getTime() ? base : now
  const nextEnd = new Date(start)
  nextEnd.setMonth(nextEnd.getMonth() + 1)

  return {
    ...gymToFormValues(gym),
    status: "active",
    subscriptionEndDate: nextEnd.toISOString(),
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
