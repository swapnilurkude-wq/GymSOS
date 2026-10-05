import { useCallback, useEffect, useState } from "react"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"
import { STORAGE_KEYS, readStorage, writeStorage } from "@/lib/storage"

export interface NotificationPreferences {
  renewalReminders: boolean
  paymentAlerts: boolean
  weeklyDigest: boolean
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  renewalReminders: true,
  paymentAlerts: true,
  weeklyDigest: false,
}

type PreferencesStore = Record<string, NotificationPreferences>

interface PreferenceRow {
  renewal_reminders: boolean
  payment_alerts: boolean
  weekly_digest: boolean
}

function fromRow(row: PreferenceRow): NotificationPreferences {
  return {
    renewalReminders: row.renewal_reminders,
    paymentAlerts: row.payment_alerts,
    weeklyDigest: row.weekly_digest,
  }
}

export function usePreferences(userId: string) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES)

  useEffect(() => {
    if (!userId) return

    if (isSupabaseConfigured()) {
      let cancelled = false
      void (async () => {
        try {
          const { data } = await getSupabase()
            .from("notification_preferences")
            .select("renewal_reminders, payment_alerts, weekly_digest")
            .eq("user_id", userId)
            .maybeSingle()
          if (!cancelled && data) setPreferences(fromRow(data as PreferenceRow))
        } catch {
          // Keep defaults when the read fails.
        }
      })()
      return () => {
        cancelled = true
      }
    }

    const store = readStorage<PreferencesStore>(STORAGE_KEYS.preferences, {})
    setPreferences(store[userId] ?? DEFAULT_PREFERENCES)
  }, [userId])

  const updatePreference = useCallback(
    (key: keyof NotificationPreferences, value: boolean) => {
      setPreferences((prev) => {
        const next = { ...prev, [key]: value }

        if (isSupabaseConfigured()) {
          void (async () => {
            try {
              await getSupabase()
                .from("notification_preferences")
                .upsert({
                  user_id: userId,
                  renewal_reminders: next.renewalReminders,
                  payment_alerts: next.paymentAlerts,
                  weekly_digest: next.weeklyDigest,
                })
            } catch {
              // Ignore write failures — the UI state is still correct.
            }
          })()
        } else {
          const store = readStorage<PreferencesStore>(STORAGE_KEYS.preferences, {})
          writeStorage(STORAGE_KEYS.preferences, { ...store, [userId]: next })
        }

        return next
      })
    },
    [userId]
  )

  return { preferences, updatePreference }
}
