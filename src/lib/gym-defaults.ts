import type { Gym, GymFormValues } from "@/types"

export function blankGymValues(): GymFormValues {
  const end = new Date()
  end.setMonth(end.getMonth() + 1)
  return {
    name: "",
    location: "",
    plan: "trial",
    status: "active",
    ownerName: "",
    ownerEmail: "",
    ownerContact: "",
    memberCount: 0,
    subscriptionEndDate: end.toISOString(),
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
