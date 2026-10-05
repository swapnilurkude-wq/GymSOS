import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"
import { STORAGE_KEYS, readStorage, writeStorage } from "@/lib/storage"
import type { Gym } from "@/types"

function initialsOf(name: string): string {
  const initials = name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 4)
  return initials || "GYM"
}

/** Receipt-number prefix derived from the gym's name (e.g. "IPF"). */
export async function getGymPrefix(gymId: string): Promise<string> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from("gyms")
      .select("name")
      .eq("id", gymId)
      .maybeSingle()
    if (error || !data) return "GYM"
    return initialsOf((data as { name: string }).name)
  }

  const gym = readStorage<Gym[]>(STORAGE_KEYS.gyms, []).find((g) => g.id === gymId)
  return gym ? initialsOf(gym.name) : "GYM"
}

/**
 * Atomically bumps one of a gym's numbering counters and returns the
 * new value. In Supabase this is an atomic upsert inside Postgres
 * (row-locked per gym); in demo mode it's a read-modify-write on
 * localStorage.
 */
export async function nextCounterValue(
  gymId: string,
  rpc: "bump_receipt_counter" | "bump_receipt_ledger_counter",
  countersKey: string
): Promise<number> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().rpc(rpc, { p_gym_id: gymId })
    if (error) throw error
    return Number(data)
  }

  const counters = readStorage<Record<string, number>>(countersKey, {})
  const next = (counters[gymId] ?? 0) + 1
  writeStorage(countersKey, { ...counters, [gymId]: next })
  return next
}
