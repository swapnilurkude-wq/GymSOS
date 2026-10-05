import { STORAGE_KEYS } from "@/lib/storage"

const APP_ID = "gym-sos"
const BACKUP_VERSION = 1

/**
 * Keys included in a full platform backup. `session` and `theme` are
 * excluded on purpose — they're device-local state, not platform data.
 */
const BACKUP_KEYS = [
  STORAGE_KEYS.users,
  STORAGE_KEYS.gyms,
  STORAGE_KEYS.members,
  STORAGE_KEYS.receiptCounters,
  STORAGE_KEYS.seeded,
  STORAGE_KEYS.preferences,
  STORAGE_KEYS.receipts,
  STORAGE_KEYS.receiptTemplates,
  STORAGE_KEYS.receiptLedgerCounters,
  STORAGE_KEYS.notificationReads,
] as const

export interface BackupFile {
  app: string
  version: number
  exportedAt: string
  data: Record<string, unknown>
}

export function buildBackup(): BackupFile {
  const data: Record<string, unknown> = {}
  for (const key of BACKUP_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw === null) continue
    try {
      data[key] = JSON.parse(raw)
    } catch {
      // Skip corrupt entries rather than failing the whole backup.
    }
  }
  return {
    app: APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  }
}

export function backupFileName(exportedAt: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  const stamp =
    `${exportedAt.getFullYear()}${pad(exportedAt.getMonth() + 1)}${pad(exportedAt.getDate())}` +
    `-${pad(exportedAt.getHours())}${pad(exportedAt.getMinutes())}`
  return `gym-sos-backup-${stamp}.json`
}

export function parseBackup(json: string): BackupFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error("The selected file is not valid JSON.")
  }

  const backup = parsed as Partial<BackupFile>
  if (backup.app !== APP_ID) {
    throw new Error("This file is not a GymSOS backup.")
  }
  if (typeof backup.version !== "number" || backup.version > BACKUP_VERSION) {
    throw new Error("This backup was created by a newer version of GymSOS.")
  }
  if (!backup.data || typeof backup.data !== "object" || Array.isArray(backup.data)) {
    throw new Error("This backup file is missing its data.")
  }

  const knownKeys = Object.keys(backup.data).filter((key) =>
    (BACKUP_KEYS as readonly string[]).includes(key)
  )
  if (knownKeys.length === 0) {
    throw new Error("This backup contains no GymSOS data.")
  }

  return {
    app: APP_ID,
    version: BACKUP_VERSION,
    exportedAt:
      typeof backup.exportedAt === "string" ? backup.exportedAt : new Date().toISOString(),
    data: backup.data,
  }
}

/** Overwrites the matching storage keys with the backup contents. Returns how many sections were restored. */
export function applyBackup(backup: BackupFile): number {
  let restored = 0
  for (const key of BACKUP_KEYS) {
    if (!(key in backup.data)) continue
    writeBackupKey(key, backup.data[key])
    restored++
  }
  return restored
}

function writeBackupKey(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}
