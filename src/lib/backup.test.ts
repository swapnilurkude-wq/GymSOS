import { describe, expect, it } from "vitest"
import { installMemoryStorage } from "@/test/helpers"
import { ensureSeeded } from "@/data/seed"
import { STORAGE_KEYS, readStorage } from "@/lib/storage"
import {
  applyBackup,
  backupFileName,
  buildBackup,
  parseBackup,
  type BackupFile,
} from "@/lib/backup"

describe("backup", () => {
  it("captures all platform data but excludes device-local state", async () => {
    installMemoryStorage()
    await ensureSeeded()
    localStorage.setItem(
      STORAGE_KEYS.session,
      JSON.stringify({ userId: "u1", role: "super-admin", name: "Admin", email: "a@b.c" })
    )
    localStorage.setItem(STORAGE_KEYS.theme, "dark")

    const backup = buildBackup()

    expect(backup.app).toBe("gym-sos")
    expect(backup.data[STORAGE_KEYS.users]).toBeDefined()
    expect(backup.data[STORAGE_KEYS.gyms]).toBeDefined()
    expect(backup.data[STORAGE_KEYS.members]).toBeDefined()
    expect(backup.data[STORAGE_KEYS.receiptTemplates]).toBeDefined()
    expect(backup.data[STORAGE_KEYS.session]).toBeUndefined()
    expect(backup.data[STORAGE_KEYS.theme]).toBeUndefined()
  })

  it("round-trips a backup through parse and apply", async () => {
    installMemoryStorage()
    await ensureSeeded()
    const backup = buildBackup()
    expect(Object.keys(backup.data).length).toBeGreaterThan(0)

    // Simulate total data loss
    localStorage.removeItem(STORAGE_KEYS.gyms)
    localStorage.removeItem(STORAGE_KEYS.members)
    localStorage.removeItem(STORAGE_KEYS.users)

    const parsed = parseBackup(JSON.stringify(backup))
    const restored = applyBackup(parsed)

    expect(restored).toBe(Object.keys(backup.data).length)
    expect(readStorage(STORAGE_KEYS.gyms, [])).toEqual(backup.data[STORAGE_KEYS.gyms])
    expect(readStorage(STORAGE_KEYS.members, [])).toEqual(backup.data[STORAGE_KEYS.members])
    expect(readStorage(STORAGE_KEYS.users, [])).toEqual(backup.data[STORAGE_KEYS.users])
  })

  it("ignores unknown keys but still restores known ones", async () => {
    installMemoryStorage()
    await ensureSeeded()
    const backup = buildBackup()
    const withFutureKey: BackupFile = {
      ...backup,
      data: { ...backup.data, "gymsos:future-key": "unknown" },
    }

    const parsed = parseBackup(JSON.stringify(withFutureKey))
    const restored = applyBackup(parsed)

    expect(restored).toBe(Object.keys(backup.data).length)
    expect(localStorage.getItem("gymsos:future-key")).toBeNull()
  })

  it("rejects files that are not valid GymSOS backups", () => {
    expect(() => parseBackup("not json{")).toThrow("not valid JSON")
    expect(() =>
      parseBackup(JSON.stringify({ app: "other-app", version: 1, data: {} }))
    ).toThrow("not a GymSOS backup")
    expect(() =>
      parseBackup(JSON.stringify({ app: "gym-sos", version: 99, data: {} }))
    ).toThrow("newer version")
    expect(() =>
      parseBackup(JSON.stringify({ app: "gym-sos", version: 1 }))
    ).toThrow("missing its data")
    expect(() =>
      parseBackup(JSON.stringify({ app: "gym-sos", version: 1, data: {} }))
    ).toThrow("no GymSOS data")
    expect(() =>
      parseBackup(
        JSON.stringify({
          app: "gym-sos",
          version: 1,
          data: { "gymsos:unknown": [] },
        })
      )
    ).toThrow("no GymSOS data")
  })

  it("names backup files with a timestamp", () => {
    expect(backupFileName(new Date(2026, 0, 5, 9, 30))).toBe(
      "gym-sos-backup-20260105-0930.json"
    )
  })
})
