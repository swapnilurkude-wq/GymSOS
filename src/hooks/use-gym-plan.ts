import { useEffect, useState } from "react"
import { useAuth } from "@/context/auth-context"
import { getAllGyms } from "@/lib/gyms"
import { getPlanFeatures, PLAN_LABEL } from "@/lib/plan-features"
import type { Gym, GymPlan } from "@/types"

export function useGymPlan() {
  const { session } = useAuth()
  const gymId = session?.gymId
  const [gym, setGym] = useState<Gym | null>(null)

  useEffect(() => {
    if (!gymId) {
      setGym(null)
      return
    }
    let cancelled = false
    getAllGyms()
      .then((gyms) => {
        if (!cancelled) setGym(gyms.find((g) => g.id === gymId) ?? null)
      })
      .catch(() => {
        if (!cancelled) setGym(null)
      })
    return () => {
      cancelled = true
    }
  }, [gymId])

  // Falls back to "trial" (most restrictive) while the gym
  // record loads, so plan-gated features stay locked until
  // the real plan is known.
  const plan: GymPlan = gym?.plan ?? "trial"

  return {
    gym,
    plan,
    planLabel: PLAN_LABEL[plan],
    features: getPlanFeatures(plan),
  }
}
