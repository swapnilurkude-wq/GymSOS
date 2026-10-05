import { beforeEach, describe, expect, it } from "vitest"
import { STORAGE_KEYS, readStorage, removeStorage, writeStorage } from "@/lib/storage"
import { DEMO_CREDENTIALS, ensureSeeded } from "@/data/seed"
import { GYM_SEED } from "@/data/gym-seed"
import { MEMBER_SEED } from "@/data/member-seed"
import {
  changeUserPassword,
  findUserByEmail,
  findUserByGymId,
  generatePassword,
  updateUserGymName,
  updateUserProfile,
  upsertGymOwnerAccount,
} from "@/lib/auth-users"
import { createGym, deleteGym, getAllGyms, updateGym } from "@/lib/gyms"
import { gymToFormValues } from "@/lib/gym-defaults"
import type { AuthUser } from "@/types"
import { createMember, deleteMember, getMembersByGym, updateMember } from "@/lib/members"
import { getGymStatus } from "@/lib/gym-status"
import { getMemberStatus } from "@/lib/member-status"
import { computeRevenueSummary, isPaying } from "@/lib/revenue"
import type { Gym } from "@/types"
import { memberToFormValues } from "@/lib/member-defaults"
import {
  computeReceiptStatus,
  createReceipt,
  getReceiptsByGym,
  receiptValuesFromMember,
} from "@/lib/receipts"
import { getReceiptTemplate } from "@/lib/receipt-template"
import { installMemoryStorage, isoDaysFromNow, makeMember } from "@/test/helpers"

function getUsers(): AuthUser[] {
  return readStorage<AuthUser[]>(STORAGE_KEYS.users, [])
}

beforeEach(async () => {
  installMemoryStorage()
  await ensureSeeded()
})

describe("storage", () => {
  it("round-trips values and removes keys", () => {
    writeStorage("gymsos:test", { nested: [1, 2, 3] })
    expect(readStorage("gymsos:test", null)).toEqual({ nested: [1, 2, 3] })

    removeStorage("gymsos:test")
    expect(readStorage("gymsos:test", "fallback")).toBe("fallback")
  })

  it("falls back when stored JSON is corrupt", () => {
    localStorage.setItem("gymsos:test", "{not json")
    expect(readStorage("gymsos:test", "fallback")).toBe("fallback")
  })
})

describe("ensureSeeded", () => {
  it("persists the demo users, gyms and members", () => {
    expect(getUsers()).toHaveLength(2)
    expect(readStorage(STORAGE_KEYS.gyms, [])).toEqual(GYM_SEED)
    expect(readStorage(STORAGE_KEYS.members, [])).toEqual(MEMBER_SEED)
    expect(readStorage(STORAGE_KEYS.seeded, false)).toBe(true)
    expect(readStorage<Record<string, number>>(STORAGE_KEYS.receiptCounters, {})).toEqual({
      "gym-demo-1": MEMBER_SEED.length,
    })
  })

  it("is idempotent — re-seeding does not duplicate data", async () => {
    await ensureSeeded()
    await ensureSeeded()
    expect(readStorage(STORAGE_KEYS.members, [])).toHaveLength(MEMBER_SEED.length)
    expect(getUsers()).toHaveLength(2)
  })

  it("exposes the demo credentials used by the login page", () => {
    expect(DEMO_CREDENTIALS.superAdmin.email).toBe("admin@gymsos.demo")
    expect(DEMO_CREDENTIALS.gymOwner.email).toBe("owner@ironpulse.com")
  })
})

describe("demo data freshness", () => {
  it("keeps the demo gym on a paying subscription", () => {
    const demoGym = readStorage<Gym[]>(STORAGE_KEYS.gyms, []).find(
      (g) => g.id === "gym-demo-1"
    )
    if (!demoGym) throw new Error("Demo gym missing from seed")

    expect(getGymStatus(demoGym)).toBe("active")
    expect(isPaying(demoGym)).toBe(true)
  })

  it("keeps a healthy mix of member statuses", async () => {
    const statuses = (await getMembersByGym("gym-demo-1")).map(getMemberStatus)
    expect(statuses).toContain("active")
    expect(statuses).toContain("expiring")
    expect(statuses).toContain("pending")
    expect(statuses).toContain("expired")
  })

  it("has paying gyms so the revenue dashboard is non-zero", () => {
    const summary = computeRevenueSummary(readStorage<Gym[]>(STORAGE_KEYS.gyms, []))
    expect(summary.payingGymCount).toBeGreaterThan(0)
    expect(summary.mrr).toBeGreaterThan(0)
  })

  it("seeds a receipt template for the demo gym", async () => {
    const template = await getReceiptTemplate("gym-demo-1")
    expect(template?.gymName).toBe("Iron Pulse Fitness")
    expect(template?.authorizedSignatureName).toBe("Rahul Deshmukh")
  })
})

describe("auth-users", () => {
  it("rejects a wrong current password and accepts the right one", () => {
    expect(changeUserPassword("user-super-admin", "wrong", "NewPass@123")).toEqual({
      ok: false,
      message: "Current password is incorrect.",
    })

    expect(changeUserPassword("user-super-admin", DEMO_CREDENTIALS.superAdmin.password, "NewPass@123")).toEqual({
      ok: true,
    })
    // The new password now works for a second change.
    expect(changeUserPassword("user-super-admin", "NewPass@123", "Another@456")).toEqual({
      ok: true,
    })
  })

  it("updates the profile and gym name of a user", () => {
    const updated = updateUserProfile("user-super-admin", { name: "Platform Admin II" })
    expect(updated?.name).toBe("Platform Admin II")
    expect(getUsers()[0].name).toBe("Platform Admin II")

    updateUserGymName("user-gym-owner-1", "Iron Pulse Fitness 2.0")
    const owner = getUsers().find((u) => u.id === "user-gym-owner-1")
    expect(owner?.gymName).toBe("Iron Pulse Fitness 2.0")
  })

  it("finds users by email and gym", async () => {
    expect((await findUserByEmail("ADMIN@gymsos.demo"))?.id).toBe("user-super-admin")
    expect(await findUserByEmail("ADMIN@gymsos.demo", "user-super-admin")).toBeUndefined()
    expect((await findUserByGymId("gym-demo-1"))?.id).toBe("user-gym-owner-1")
  })

  it("generates passwords of the requested length from the allowed alphabet", () => {
    const password = generatePassword(12)
    expect(password).toHaveLength(12)
    expect(password).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789]+$/)
  })

  it("creates a new gym-owner account and updates the existing one in place", async () => {
    const created = await upsertGymOwnerAccount({
      gymId: "gym-new-1",
      gymName: "New Gym",
      ownerName: "New Owner",
      email: "new@owner.in",
      password: "Owner@123",
    })
    expect(created.role).toBe("gym-owner")
    expect(created.gymId).toBe("gym-new-1")

    const updated = await upsertGymOwnerAccount({
      gymId: "gym-new-1",
      gymName: "New Gym Renamed",
      ownerName: "New Owner II",
      email: "new2@owner.in",
    })
    expect(updated.id).toBe(created.id)
    expect(updated.gymName).toBe("New Gym Renamed")
    expect(updated.password).toBe("Owner@123")
    expect(getUsers().filter((u) => u.gymId === "gym-new-1")).toHaveLength(1)
  })

  it("requires a password when creating a brand-new account", async () => {
    await expect(
      upsertGymOwnerAccount({
        gymId: "gym-new-2",
        gymName: "Another Gym",
        ownerName: "Another Owner",
        email: "another@owner.in",
      })
    ).rejects.toThrow("A password is required to create a new login account.")
  })
})

describe("gyms CRUD", () => {
  it("creates, updates and deletes gyms", async () => {
    const created = await createGym({
      name: "New Gym",
      location: "Mumbai",
      plan: "starter",
      status: "active",
      ownerName: "Owner",
      ownerEmail: "owner@newgym.in",
      ownerContact: "9820000000",
      memberCount: 10,
      subscriptionEndDate: isoDaysFromNow(30),
    })
    expect(created.id).toBeTruthy()
    expect(created.createdAt).toBeTruthy()
    expect(await getAllGyms()).toHaveLength(GYM_SEED.length + 1)

    const updated = await updateGym(created.id, {
      ...gymToFormValues(created),
      name: "New Gym Renamed",
      memberCount: 20,
    })
    expect(updated?.name).toBe("New Gym Renamed")
    expect(updated?.memberCount).toBe(20)

    await deleteGym(created.id)
    expect(await getAllGyms()).toHaveLength(GYM_SEED.length)
    expect(await updateGym(created.id, { ...gymToFormValues(created), name: "Ghost" })).toBeNull()
  })
})

describe("members CRUD", () => {
  it("creates members with sequential receipt numbers and computed balance", async () => {
    const created = await createMember("gym-demo-1", {
      ...memberToFormValues(makeMember({ name: "New Member" })),
      amount: 5000,
      discount: 500,
      paidAmount: 3000,
      cashAmount: 3000,
    })

    expect(created.receiptNumber).toBe("IPF-0009")
    expect(created.balanceAmount).toBe(1500)
    expect(await getMembersByGym("gym-demo-1")).toHaveLength(MEMBER_SEED.length + 1)
    expect(await getMembersByGym("gym-other")).toHaveLength(0)

    const updated = await updateMember(created.id, {
      ...memberToFormValues(makeMember({ name: "New Member" })),
      amount: 5000,
      discount: 500,
      paidAmount: 4500,
      cashAmount: 4500,
    })
    expect(updated?.balanceAmount).toBe(0)
    expect(updated?.name).toBe("New Member")

    await deleteMember(created.id)
    expect(await getMembersByGym("gym-demo-1")).toHaveLength(MEMBER_SEED.length)
    expect(await updateMember(created.id, memberToFormValues(makeMember()))).toBeNull()
  })
})

describe("receipts", () => {
  it("computes status and balance from amounts", () => {
    expect(computeReceiptStatus(100, 100)).toBe("paid")
    expect(computeReceiptStatus(100, 40)).toBe("partial")
    expect(computeReceiptStatus(100, 0)).toBe("pending")
  })

  it("creates receipts with ledger numbers, status and balance", async () => {
    const member = makeMember({
      amount: 7500,
      discount: 0,
      paidAmount: 5000,
      cashAmount: 5000,
    })
    const receipt = await createReceipt("gym-demo-1", receiptValuesFromMember(member))

    expect(receipt.receiptNumber).toBe("IPF-RCT-0001")
    expect(receipt.status).toBe("partial")
    expect(receipt.balanceAmount).toBe(2500)
    expect(await getReceiptsByGym("gym-demo-1")).toHaveLength(1)
    expect(await getReceiptsByGym("gym-other")).toHaveLength(0)
  })
})
