import { useCallback, useEffect, useState } from "react"
import {
  getMembersByGym,
  createMember as createMemberRecord,
  updateMember as updateMemberRecord,
  deleteMember as deleteMemberRecord,
  importMembers as importMemberRecords,
} from "@/lib/members"
import type { Member, MemberFormValues } from "@/types"

export function useMembers(gymId: string) {
  const [members, setMembers] = useState<Member[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setMembers(await getMembersByGym(gymId))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load members.")
    } finally {
      setIsLoading(false)
    }
  }, [gymId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addMember = useCallback(
    async (values: MemberFormValues) => {
      const created = await createMemberRecord(gymId, values)
      await refresh()
      return created
    },
    [gymId, refresh]
  )

  const editMember = useCallback(
    async (id: string, values: MemberFormValues) => {
      const updated = await updateMemberRecord(id, values)
      await refresh()
      return updated
    },
    [refresh]
  )

  const removeMember = useCallback(
    async (id: string) => {
      await deleteMemberRecord(id)
      await refresh()
    },
    [refresh]
  )

  const importMembers = useCallback(
    async (rows: MemberFormValues[]) => {
      const created = await importMemberRecords(gymId, rows)
      await refresh()
      return created
    },
    [gymId, refresh]
  )

  return { members, isLoading, error, addMember, editMember, removeMember, importMembers, refresh }
}
