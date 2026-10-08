import { describe, expect, it } from "vitest"
import {
  installMemoryStorage,
  isoDaysFromNow,
  makeGym,
} from "@/test/helpers"
import { STORAGE_KEYS, writeStorage } from "@/lib/storage"
import {
  computeGymOwnerNotifications,
  computeSuperAdminNotifications,
} from "@/lib/notifications"
import type { NotificationPreferences } from "@/hooks/use-preferences"

const NO_PREFERENCES: NotificationPreferences = {
  renewalReminders: false,
  paymentAlerts: false,
  weeklyDigest: false,
}

function installGym(gym: ReturnType<typeof makeGym>): void {
  writeStorage(STORAGE_KEYS.gyms, [gym])
  writeStorage(STORAGE_KEYS.members, [])
  writeStorage(STORAGE_KEYS.receipts, [])
}

describe("gym owner trial reminders", () => {
  it("warns when the trial expires within three days", async () => {
    installMemoryStorage()
    const gym = makeGym({
      plan: "trial",
      subscriptionEndDate: isoDaysFromNow(2),
    })
    installGym(gym)

    const items = await computeGymOwnerNotifications(
      gym.id,
      NO_PREFERENCES
    )
    const reminder = items.find((item) => item.id.startsWith("trial-"))

    expect(reminder).toBeDefined()
    expect(reminder!.title).toBe("Your free trial expires in 2 days.")
    expect(reminder!.tone).toBe("warning")
  })

  it("warns the day before the trial ends", async () => {
    installMemoryStorage()
    const gym = makeGym({
      plan: "trial",
      subscriptionEndDate: isoDaysFromNow(1),
    })
    installGym(gym)

    const items = await computeGymOwnerNotifications(
      gym.id,
      NO_PREFERENCES
    )
    const reminder = items.find((item) => item.id.startsWith("trial-"))

    expect(reminder).toBeDefined()
    expect(reminder!.title).toBe("Your free trial expires tomorrow.")
  })

  it("stays quiet while the trial has runway", async () => {
    installMemoryStorage()
    const gym = makeGym({
      plan: "trial",
      subscriptionEndDate: isoDaysFromNow(8),
    })
    installGym(gym)

    const items = await computeGymOwnerNotifications(
      gym.id,
      NO_PREFERENCES
    )
    expect(items.some((item) => item.id.startsWith("trial-"))).toBe(false)
  })

  it("stays quiet for paid gyms", async () => {
    installMemoryStorage()
    const gym = makeGym({
      plan: "pro",
      subscriptionEndDate: isoDaysFromNow(2),
    })
    installGym(gym)

    const items = await computeGymOwnerNotifications(
      gym.id,
      NO_PREFERENCES
    )
    expect(items.some((item) => item.id.startsWith("trial-"))).toBe(false)
  })
})

describe("super admin trial signup notification", () => {
  it("announces a new trial signup and links to subscriptions", async () => {
    installMemoryStorage()
    const gym = makeGym({
      plan: "trial",
      createdAt: isoDaysFromNow(-1),
    })
    installGym(gym)

    const items = await computeSuperAdminNotifications(NO_PREFERENCES)
    const signup = items.find((item) => item.id === `new-gym-${gym.id}`)

    expect(signup).toBeDefined()
    expect(signup!.title).toBe(`${gym.name} started a 10-day free trial`)
    expect(signup!.link).toBe("/super-admin/subscriptions")
  })

  it("keeps the plain onboarding message for paid gyms", async () => {
    installMemoryStorage()
    const gym = makeGym({
      plan: "pro",
      createdAt: isoDaysFromNow(-1),
    })
    installGym(gym)

    const items = await computeSuperAdminNotifications(NO_PREFERENCES)
    const signup = items.find((item) => item.id === `new-gym-${gym.id}`)

    expect(signup).toBeDefined()
    expect(signup!.title).toBe(`New gym onboarded: ${gym.name}`)
    expect(signup!.link).toBe("/super-admin/gyms")
  })
})
