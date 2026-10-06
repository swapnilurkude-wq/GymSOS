import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"
import { fromGymRow, toGymPatch, toGymRow, type GymRow } from "@/lib/supabase-rows"
import { STORAGE_KEYS, readStorage, writeStorage } from "@/lib/storage"
import type { Gym, GymFormValues } from "@/types"

export async function getAllGyms(): Promise<Gym[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from("gyms")
      .select("*")

    if (error) {
      console.error("GYMS LOAD ERROR:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })

      throw new Error(
        `Gyms load failed: ${error.message} (code: ${error.code})`
      )
    }

    return ((data ?? []) as GymRow[]).map(fromGymRow)
  }

  return readStorage<Gym[]>(STORAGE_KEYS.gyms, [])
}

export async function createGym(values: GymFormValues): Promise<Gym> {
  const gym: Gym = {
    ...values,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }

  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from("gyms")
      .insert(toGymRow(gym))
      .select("*")
      .single()

    if (error) throw error

    return fromGymRow(data as GymRow)
  }

  writeStorage<Gym[]>(
    STORAGE_KEYS.gyms,
    [...readStorage<Gym[]>(STORAGE_KEYS.gyms, []), gym]
  )

  return gym
}

export async function updateGym(
  id: string,
  values: GymFormValues
): Promise<Gym | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from("gyms")
      .update(toGymPatch(values))
      .eq("id", id)
      .select("*")
      .maybeSingle()

    if (error) throw error

    return data ? fromGymRow(data as GymRow) : null
  }

  const all = readStorage<Gym[]>(STORAGE_KEYS.gyms, [])
  const index = all.findIndex((g) => g.id === id)

  if (index === -1) return null

  const updated: Gym = {
    ...all[index],
    ...values,
  }

  const next = [...all]
  next[index] = updated

  writeStorage(STORAGE_KEYS.gyms, next)

  return updated
}

export async function deleteGym(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabase()
      .from("gyms")
      .delete()
      .eq("id", id)

    if (error) throw error

    return
  }

  writeStorage(
    STORAGE_KEYS.gyms,
    readStorage<Gym[]>(STORAGE_KEYS.gyms, []).filter(
      (g) => g.id !== id
    )
  )
}