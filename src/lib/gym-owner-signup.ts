import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase"
import { STORAGE_KEYS, readStorage, writeStorage } from "@/lib/storage"
import type { AuthUser, Gym } from "@/types"

export interface GymOwnerSignupInput {
  gymName: string
  ownerName: string
  mobile: string
  email: string
  password: string
  confirmPassword: string
}

export interface GymOwnerSignupResult {
  gymId: string
  gymName: string
  ownerName: string
  email: string
}

const DAY_MS = 1000 * 60 * 60 * 24

/**
 * Public Gym Owner signup with a 10-day free trial.
 *
 * Production: delegates to the gym-owner-signup Edge
 * Function, which creates the Auth user (the trigger
 * assigns role = 'gym-owner' server-side), the gym and
 * the trial dates. The Edge Function is called with the
 * anon key — Supabase verifies it as the "anon" role,
 * so no user session is needed.
 *
 * Demo mode (development only): mirrors the same flow
 * against localStorage. The trial end date is computed
 * here only because there is no server in demo mode —
 * in production it always comes from Postgres.
 */
export async function signUpGymOwner(
  input: GymOwnerSignupInput
): Promise<GymOwnerSignupResult> {
  if (isSupabaseConfigured()) {
    // The Edge Function is protected by JWT verification —
    // the anon key is sent as a Bearer token (Supabase
    // verifies it as the "anon" role), so the public
    // signup page can call it without a user session.
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/gym-owner-signup`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(input),
      }
    )

    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload.error) {
      throw new Error(
        typeof payload.error === "string"
          ? payload.error
          : `Couldn't create your account (HTTP ${response.status}). Please try again.`
      )
    }

    return {
      gymId: payload.gymId,
      gymName: payload.gymName,
      ownerName: payload.ownerName,
      email: payload.email,
    }
  }

  const email = input.email.trim().toLowerCase()
  const mobile = input.mobile.trim()

  const users = readStorage<AuthUser[]>(STORAGE_KEYS.users, [])
  if (users.some((user) => user.email.toLowerCase() === email)) {
    throw new Error("This email is already registered. Please sign in instead.")
  }

  const gyms = readStorage<Gym[]>(STORAGE_KEYS.gyms, [])
  if (gyms.some((gym) => gym.ownerContact === mobile)) {
    throw new Error(
      "This mobile number is already linked to a gym. Please sign in instead."
    )
  }

  const gymId = crypto.randomUUID()
  const now = new Date().toISOString()

  const gym: Gym = {
    id: gymId,
    name: input.gymName.trim(),
    location: "",
    plan: "trial",
    status: "active",
    ownerName: input.ownerName.trim(),
    ownerEmail: email,
    ownerContact: mobile,
    memberCount: 0,
    subscriptionEndDate: new Date(Date.now() + 10 * DAY_MS).toISOString(),
    createdAt: now,
  }
  writeStorage<Gym[]>(STORAGE_KEYS.gyms, [...gyms, gym])

  const user: AuthUser = {
    id: crypto.randomUUID(),
    name: input.ownerName.trim(),
    email,
    // Demo mode only — Supabase Auth owns passwords in production.
    password: input.password,
    role: "gym-owner",
    gymId,
    gymName: gym.name,
    createdAt: now,
  }
  writeStorage<AuthUser[]>(STORAGE_KEYS.users, [...users, user])

  return { gymId, gymName: gym.name, ownerName: user.name, email }
}
