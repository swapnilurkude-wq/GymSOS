import { beforeEach, describe, expect, it } from "vitest"
import { installMemoryStorage } from "@/test/helpers"
import { ensureSeeded } from "@/data/seed"
import { STORAGE_KEYS, readStorage } from "@/lib/storage"
import { signUpGymOwner } from "@/lib/gym-owner-signup"
import type { AuthUser, Gym } from "@/types"

/**
 * Demo-mode signup: the same validation and outcomes
 * as the Edge Function, mirrored against localStorage.
 * The Supabase branch is covered by
 * gym-owner-signup-remote.test.ts.
 */

const VALID = {
  gymName: "New Gym",
  ownerName: "New Owner",
  mobile: "9820000000",
  email: "new@gym.in",
  password: "Password1",
  confirmPassword: "Password1",
}

describe("gym owner signup — demo mode", () => {
  beforeEach(async () => {
    installMemoryStorage()
    await ensureSeeded()
  })

  it("creates a trial gym and a gym-owner account", async () => {
    const result = await signUpGymOwner(VALID)

    expect(result.gymName).toBe("New Gym")
    expect(result.ownerName).toBe("New Owner")
    expect(result.email).toBe("new@gym.in")

    const gyms = readStorage<Gym[]>(STORAGE_KEYS.gyms, [])
    const gym = gyms.find((g) => g.id === result.gymId)
    expect(gym).toBeDefined()
    expect(gym!.name).toBe("New Gym")
    expect(gym!.plan).toBe("trial")
    expect(gym!.status).toBe("active")
    expect(gym!.ownerName).toBe("New Owner")
    expect(gym!.ownerEmail).toBe("new@gym.in")
    expect(gym!.ownerContact).toBe("9820000000")
    expect(gym!.memberCount).toBe(0)

    // The trial runs for exactly 10 days from signup.
    const days = Math.round(
      (new Date(gym!.subscriptionEndDate).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    )
    expect(days).toBe(10)

    const users = readStorage<AuthUser[]>(STORAGE_KEYS.users, [])
    const user = users.find((u) => u.email === "new@gym.in")
    expect(user).toBeDefined()
    expect(user!.role).toBe("gym-owner")
    expect(user!.gymId).toBe(result.gymId)
    expect(user!.gymName).toBe("New Gym")
  })

  it("rejects a duplicate email", async () => {
    await expect(
      signUpGymOwner({ ...VALID, email: "owner@ironpulse.com" })
    ).rejects.toThrow(/already registered/i)
  })

  it("rejects a duplicate mobile number", async () => {
    await expect(
      signUpGymOwner({ ...VALID, mobile: "9822099001" })
    ).rejects.toThrow(/already linked to a gym/i)
  })
})
