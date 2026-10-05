import { useEffect, useState } from "react"
import { getReceiptTemplate } from "@/lib/receipt-template"
import type { ReceiptTemplate } from "@/types"

/** Loads a gym's receipt template (null until loaded / when absent). */
export function useReceiptTemplate(gymId: string): ReceiptTemplate | null {
  const [template, setTemplate] = useState<ReceiptTemplate | null>(null)

  useEffect(() => {
    if (!gymId) {
      setTemplate(null)
      return
    }
    let cancelled = false
    getReceiptTemplate(gymId)
      .then((t) => {
        if (!cancelled) setTemplate(t)
      })
      .catch(() => {
        if (!cancelled) setTemplate(null)
      })
    return () => {
      cancelled = true
    }
  }, [gymId])

  return template
}
