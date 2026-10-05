import { useCallback, useEffect, useState } from "react"
import {
  getReceiptsByGym,
  createReceipt as createReceiptRecord,
  updateReceipt as updateReceiptRecord,
  deleteReceipt as deleteReceiptRecord,
} from "@/lib/receipts"
import type { Receipt, ReceiptFormValues } from "@/types"

export function useReceipts(gymId: string) {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setReceipts(await getReceiptsByGym(gymId))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load receipts.")
    } finally {
      setIsLoading(false)
    }
  }, [gymId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addReceipt = useCallback(
    async (values: ReceiptFormValues) => {
      const created = await createReceiptRecord(gymId, values)
      await refresh()
      return created
    },
    [gymId, refresh]
  )

  const editReceipt = useCallback(
    async (id: string, values: ReceiptFormValues) => {
      const updated = await updateReceiptRecord(id, values)
      await refresh()
      return updated
    },
    [refresh]
  )

  const removeReceipt = useCallback(
    async (id: string) => {
      await deleteReceiptRecord(id)
      await refresh()
    },
    [refresh]
  )

  return { receipts, isLoading, error, addReceipt, editReceipt, removeReceipt, refresh }
}
