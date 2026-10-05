import { configurationError, isDemoMode } from "@/lib/supabase"

const NAMESPACE = "gymsos"

export const STORAGE_KEYS = {
  users: `${NAMESPACE}:users`,
  gyms: `${NAMESPACE}:gyms`,
  members: `${NAMESPACE}:members`,
  receiptCounters: `${NAMESPACE}:receipt-counters`,
  session: `${NAMESPACE}:session`,
  theme: `${NAMESPACE}:theme`,
  seeded: `${NAMESPACE}:seeded`,
  preferences: `${NAMESPACE}:preferences`,
  receipts: `${NAMESPACE}:receipts`,
  receiptTemplates: `${NAMESPACE}:receipt-templates`,
  receiptLedgerCounters: `${NAMESPACE}:receipt-ledger-counters`,
  notificationReads: `${NAMESPACE}:notification-reads`,
} as const

/**
 * localStorage is the demo-mode (development) data store.
 * In production the app runs on Supabase/Postgres, so any
 * access fails fast rather than silently persisting platform
 * data to a browser. Device-local concerns (theme, session
 * cookies) use raw localStorage and are unaffected.
 */
function assertDemoMode(): void {
  if (!isDemoMode()) throw configurationError()
}

export function readStorage<T>(key: string, fallback: T): T {
  assertDemoMode()
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeStorage<T>(key: string, value: T): void {
  assertDemoMode()
  localStorage.setItem(key, JSON.stringify(value))
}

export function removeStorage(key: string): void {
  assertDemoMode()
  localStorage.removeItem(key)
}
