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