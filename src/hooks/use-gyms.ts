import { useCallback, useEffect, useState } from "react"
import {
  getAllGyms,
  createGym as createGymRecord,
  updateGym as updateGymRecord,
  deleteGym as deleteGymRecord,
} from "@/lib/gyms"
import type { Gym, GymFormValues } from "@/types"

export function useGyms() {
  const [gyms, setGyms] = useState<Gym[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setGyms(await getAllGyms())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load gyms.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addGym = useCallback(
    async (values: GymFormValues) => {
      const created = await createGymRecord(values)
      await refresh()
      return created
    },
    [refresh]
  )

  const editGym = useCallback(
    async (id: string, values: GymFormValues) => {
      const updated = await updateGymRecord(id, values)
      await refresh()
      return updated
    },
    [refresh]
  )

  const removeGym = useCallback(
    async (id: string) => {
      await deleteGymRecord(id)
      await refresh()
    },
    [refresh]
  )

  return { gyms, isLoading, error, addGym, editGym, removeGym, refresh }
}
