import type { Gym, GymFormValues } from "@/types"

export function blankGymValues(): GymFormValues {
  return {
    name: "",
    location: "",
    plan: "trial",
    status: "active",
    ownerName: "",
    ownerEmail: "",
    ownerContact: "",
    memberCount: 0,
    // No default renewal date — the admin sets it.
    subscriptionEndDate: "",
  }
}

export function gymToFormValues(gym: Gym): GymFormValues {
  return {
    name: gym.name,
    location: gym.location,
    plan: gym.plan,
    status: gym.status,
    ownerName: gym.ownerName,
    ownerEmail: gym.ownerEmail,
    ownerContact: gym.ownerContact,
    memberCount: gym.memberCount,
    subscriptionEndDate: gym.subscriptionEndDate,
  }
}
