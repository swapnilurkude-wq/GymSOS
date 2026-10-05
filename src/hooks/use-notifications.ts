import { useCallback, useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { useAuth } from "@/context/auth-context"
import { usePreferences } from "@/hooks/use-preferences"
import {
  loadNotificationReads,
  persistNotificationRead,
  persistNotificationReads,
} from "@/lib/notification-reads"
import { computeGymOwnerNotifications, computeSuperAdminNotifications } from "@/lib/notifications"
import type { AppNotification } from "@/types"

export function useNotifications() {
  const { session } = useAuth()
  const location = useLocation()
  const { preferences } = usePreferences(session?.userId ?? "")
  const [refreshTick, setRefreshTick] = useState(0)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  // Read markers
  useEffect(() => {
    const userId = session?.userId
    if (!userId) {
      setReadIds(new Set())
      return
    }
    let cancelled = false
    loadNotificationReads(userId)
      .then((ids) => {
        if (!cancelled) setReadIds(ids)
      })
      .catch(() => {
        if (!cancelled) setReadIds(new Set())
      })
    return () => {
      cancelled = true
    }
  }, [session?.userId])

  // Computed notifications (data is fetched async in Supabase mode)
  useEffect(() => {
    if (!session) {
      setNotifications([])
      return
    }
    let cancelled = false
    const compute =
      session.role === "gym-owner"
        ? computeGymOwnerNotifications(session.gymId ?? "", preferences)
        : computeSuperAdminNotifications(preferences)
    compute
      .then((items) => {
        if (!cancelled) setNotifications(items)
      })
      .catch(() => {
        if (!cancelled) setNotifications([])
      })
    return () => {
      cancelled = true
    }
    // location.pathname and refreshTick intentionally force a recompute
  }, [session, preferences, location.pathname, refreshTick])

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), [])

  const markRead = useCallback(
    (id: string) => {
      if (!session) return
      setReadIds((prev) => {
        if (prev.has(id)) return prev
        const next = new Set(prev)
        next.add(id)
        void persistNotificationRead(session.userId, id).catch(() => {})
        return next
      })
    },
    [session]
  )

  const markAllRead = useCallback(() => {
    if (!session) return
    setReadIds((prev) => {
      const next = new Set(prev)
      const fresh = notifications.filter((n) => !next.has(n.id)).map((n) => n.id)
      fresh.forEach((id) => next.add(id))
      if (fresh.length > 0) {
        void persistNotificationReads(session.userId, fresh).catch(() => {})
      }
      return next
    })
  }, [session, notifications])

  const isRead = useCallback((id: string) => readIds.has(id), [readIds])

  return { notifications, unreadCount, isRead, markRead, markAllRead, refresh }
}
