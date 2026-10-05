import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"
import { STORAGE_KEYS, readStorage, writeStorage } from "@/lib/storage"

/**
 * Per-user "read" markers for notifications. Supabase mode
 * stores them in the notification_reads table; demo mode keeps
 * them in localStorage.
 */

export async function loadNotificationReads(userId: string): Promise<Set<string>> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from("notification_reads")
      .select("notification_id")
      .eq("user_id", userId)
    if (error) throw error
    return new Set(
      ((data ?? []) as { notification_id: string }[]).map((r) => r.notification_id)
    )
  }

  const store = readStorage<Record<string, string[]>>(STORAGE_KEYS.notificationReads, {})
  return new Set(store[userId] ?? [])
}

export async function persistNotificationRead(
  userId: string,
  id: string
): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabase()
      .from("notification_reads")
      .upsert({ user_id: userId, notification_id: id })
    if (error) throw error
    return
  }

  await persistNotificationReads(userId, [id])
}

export async function persistNotificationReads(
  userId: string,
  ids: string[]
): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabase()
      .from("notification_reads")
      .upsert(ids.map((notification_id) => ({ user_id: userId, notification_id })))
    if (error) throw error
    return
  }

  const store = readStorage<Record<string, string[]>>(STORAGE_KEYS.notificationReads, {})
  const next = new Set(store[userId] ?? [])
  ids.forEach((id) => next.add(id))
  writeStorage(STORAGE_KEYS.notificationReads, {
    ...store,
    [userId]: Array.from(next),
  })
}
