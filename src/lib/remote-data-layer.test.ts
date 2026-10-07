import { beforeEach, describe, expect, it, vi } from "vitest"
import { createSupabaseMock } from "@/test/supabase-mock"
import { installMemoryStorage, isoDaysFromNow, makeGym, makeMember } from "@/test/helpers"
import { toGymRow, toMemberRow } from "@/lib/supabase-rows"
import { memberToFormValues } from "@/lib/member-defaults"
import { receiptValuesFromMember } from "@/lib/receipts"

/**
 * Exercises the Supabase branches of the data layer against an
 * in-memory client (src/test/supabase-mock.ts). The localStorage
 * branches of the same functions are covered by seed.test.ts and
 * the walkthrough test.
 */

let mock: ReturnType<typeof createSupabaseMock>

// The data modules import the Supabase seam at load time, so the
// mock has to be in place first. The closures read `mock` when a
// query runs — by then, beforeEach has installed a fresh client.
vi.mock("@/lib/supabase", () => ({
  SUPABASE_URL: "https://mock.supabase.co",
  getSupabase: () => mock.client,
  isSupabaseConfigured: () => true,
}))

import { createGym, deleteGym, getAllGyms, updateGym } from "@/lib/gyms"
import {
  createMember,
  getMembersByGym,
  importMembers,
  updateMember,
} from "@/lib/members"
import {
  createReceipt,
  getReceiptsByMember,
  getReceiptsByGym,
  updateReceipt,
} from "@/lib/receipts"
import { getReceiptTemplate, upsertReceiptTemplate } from "@/lib/receipt-template"
import { findUserByEmail, findUserByGymId, upsertGymOwnerAccount } from "@/lib/auth-users"
import {
  loadNotificationReads,
  persistNotificationRead,
  persistNotificationReads,
} from "@/lib/notification-reads"

const DEMO_GYM = makeGym()

beforeEach(() => {
  installMemoryStorage()
  mock = createSupabaseMock()
  mock.seedTable("gyms", [toGymRow(DEMO_GYM)])
})

describe("gyms — Supabase mode", () => {
  it("reads all gyms and maps rows to domain objects", async () => {
    const gyms = await getAllGyms()
    expect(gyms).toEqual([DEMO_GYM])
  })

  it("creates a gym row with snake_case columns", async () => {
    const created = await createGym({
      name: "New Gym",
      location: "Mumbai",
      plan: "starter",
      status: "active",
      ownerName: "New Owner",
      ownerEmail: "new@owner.in",
      ownerContact: "9820000000",
      memberCount: 5,
      subscriptionEndDate: isoDaysFromNow(30),
    })

    expect(created.name).toBe("New Gym")
    expect(created.createdAt).toBeTruthy()

    const rows = mock.tableRows("gyms")
    expect(rows).toHaveLength(2)
    const inserted = rows[1]
    expect(inserted.name).toBe("New Gym")
    expect(inserted.owner_name).toBe("New Owner")
    expect(inserted.owner_email).toBe("new@owner.in")
    expect(inserted.member_count).toBe(5)
    expect(inserted.plan).toBe("starter")
  })

  it("updates the matching row and returns the merged gym", async () => {
    const updated = await updateGym(DEMO_GYM.id, {
      name: "Renamed Gym",
      location: DEMO_GYM.location,
      plan: "growth",
      status: DEMO_GYM.status,
      ownerName: DEMO_GYM.ownerName,
      ownerEmail: DEMO_GYM.ownerEmail,
      ownerContact: DEMO_GYM.ownerContact,
      memberCount: 99,
      subscriptionEndDate: DEMO_GYM.subscriptionEndDate,
    })

    expect(updated?.name).toBe("Renamed Gym")
    expect(updated?.memberCount).toBe(99)
    expect(mock.tableRows("gyms")).toHaveLength(1)
    expect(mock.tableRows("gyms")[0].member_count).toBe(99)
  })

  it("returns null when updating a gym that doesn't exist", async () => {
    const updated = await updateGym("gym-missing", {
      name: "Ghost",
      location: "Nowhere",
      plan: "trial",
      status: "active",
      ownerName: "Nobody",
      ownerEmail: "nobody@nowhere.in",
      ownerContact: "0000000000",
      memberCount: 0,
      subscriptionEndDate: isoDaysFromNow(30),
    })
    expect(updated).toBeNull()
  })

  it("deletes the gym row", async () => {
    await deleteGym(DEMO_GYM.id)
    expect(mock.tableRows("gyms")).toHaveLength(0)
    expect(await getAllGyms()).toHaveLength(0)
  })
})

describe("members — Supabase mode", () => {
  it("lists only the requested gym's members", async () => {
    mock.seedTable("members", [
      toMemberRow(makeMember({ id: "member-1", gymId: DEMO_GYM.id })),
      toMemberRow(makeMember({ id: "member-2", gymId: "gym-other" })),
    ])

    const members = await getMembersByGym(DEMO_GYM.id)
    expect(members.map((m) => m.id)).toEqual(["member-1"])
  })

  it("creates a member with a bumped receipt number and computed balance", async () => {
    const created = await createMember(DEMO_GYM.id, {
      ...memberToFormValues(makeMember({ name: "New Member" })),
      amount: 5000,
      discount: 500,
      paidAmount: 3000,
    })

    expect(created.receiptNumber).toBe("IPF-0001")
    expect(created.balanceAmount).toBe(1500)

    const rows = mock.tableRows("members")
    expect(rows).toHaveLength(1)
    expect(rows[0].receipt_number).toBe("IPF-0001")
    expect(rows[0].balance_amount).toBe(1500)
    expect(rows[0].gym_id).toBe(DEMO_GYM.id)
    expect(rows[0].paid_amount).toBe(3000)
  })

  it("numbers members sequentially through the counter RPC", async () => {
    await createMember(DEMO_GYM.id, memberToFormValues(makeMember({ name: "First" })))
    await createMember(DEMO_GYM.id, memberToFormValues(makeMember({ name: "Second" })))

    expect(mock.tableRows("members").map((row) => row.receipt_number)).toEqual([
      "IPF-0001",
      "IPF-0002",
    ])
  })

  it("updates the member and recomputes the balance", async () => {
    const created = await createMember(DEMO_GYM.id, memberToFormValues(makeMember()))
    expect(created.balanceAmount).toBe(0)

    const updated = await updateMember(created.id, {
      ...memberToFormValues(makeMember()),
      paidAmount: 0,
      cashAmount: 0,
    })

    expect(updated?.balanceAmount).toBe(2500)
    expect(mock.tableRows("members")[0].balance_amount).toBe(2500)
    expect(mock.tableRows("members")).toHaveLength(1)
  })

  it("imports several members in a single insert", async () => {
    const created = await importMembers(DEMO_GYM.id, [
      memberToFormValues(makeMember({ name: "First" })),
      memberToFormValues(makeMember({ name: "Second" })),
    ])

    expect(created.map((m) => m.receiptNumber)).toEqual(["IPF-0001", "IPF-0002"])
    expect(mock.tableRows("members")).toHaveLength(2)
  })
})

describe("receipts — Supabase mode", () => {
  it("creates a receipt with a ledger number, status and balance", async () => {
    const member = makeMember({ amount: 7500, paidAmount: 5000 })
    const receipt = await createReceipt(DEMO_GYM.id, receiptValuesFromMember(member))

    expect(receipt.receiptNumber).toBe("IPF-RCT-0001")
    expect(receipt.status).toBe("partial")
    expect(receipt.balanceAmount).toBe(2500)

    const rows = mock.tableRows("receipts")
    expect(rows).toHaveLength(1)
    expect(rows[0].receipt_number).toBe("IPF-RCT-0001")
    expect(rows[0].status).toBe("partial")
    expect(rows[0].balance_amount).toBe(2500)
    expect(rows[0].gym_id).toBe(DEMO_GYM.id)
  })

  it("numbers receipts sequentially through the ledger counter RPC", async () => {
    const member = makeMember()
    await createReceipt(DEMO_GYM.id, receiptValuesFromMember(member))
    await createReceipt(DEMO_GYM.id, receiptValuesFromMember(member))

    expect(mock.tableRows("receipts").map((row) => row.receipt_number)).toEqual([
      "IPF-RCT-0001",
      "IPF-RCT-0002",
    ])
  })

  it("lists receipts by gym and by member", async () => {
    const member = makeMember()
    const otherMember = makeMember({ id: "member-other" })
    await createReceipt(DEMO_GYM.id, receiptValuesFromMember(member))
    await createReceipt("gym-other", receiptValuesFromMember(otherMember))

    expect(await getReceiptsByGym(DEMO_GYM.id)).toHaveLength(1)
    expect(await getReceiptsByMember(member.id)).toHaveLength(1)
  })

  it("updates a receipt and recomputes status and balance", async () => {
    const member = makeMember({ amount: 7500, paidAmount: 5000 })
    const receipt = await createReceipt(DEMO_GYM.id, receiptValuesFromMember(member))

    const updated = await updateReceipt(receipt.id, {
      ...receiptValuesFromMember(member),
      amountPaid: 7500,
      cashAmount: 7500,
    })

    expect(updated?.status).toBe("paid")
    expect(updated?.balanceAmount).toBe(0)
    expect(mock.tableRows("receipts")[0].status).toBe("paid")
  })
})

describe("receipt templates — Supabase mode", () => {
  const TEMPLATE_VALUES = {
    gymName: "Iron Pulse Fitness",
    gymAddress: "Baner Road, Pune",
    contactNumber: "9822099001",
    termsAndConditions: "Fees are non-refundable.",
    authorizedSignatureName: "Rahul Deshmukh",
  }

  it("returns null when the gym has no template", async () => {
    expect(await getReceiptTemplate(DEMO_GYM.id)).toBeNull()
  })

  it("upserts the template keyed by gym", async () => {
    await upsertReceiptTemplate(DEMO_GYM.id, TEMPLATE_VALUES)
    expect(mock.tableRows("receipt_templates")).toHaveLength(1)
    expect(mock.tableRows("receipt_templates")[0].gym_name).toBe("Iron Pulse Fitness")

    await upsertReceiptTemplate(DEMO_GYM.id, {
      ...TEMPLATE_VALUES,
      gymAddress: "New Address",
    })
    expect(mock.tableRows("receipt_templates")).toHaveLength(1)
    expect(mock.tableRows("receipt_templates")[0].gym_address).toBe("New Address")
  })

  it("reads a seeded template and maps it to camelCase", async () => {
    mock.seedTable("receipt_templates", [
      {
        gym_id: DEMO_GYM.id,
        logo_url: null,
        gym_name: "Iron Pulse Fitness",
        gym_address: "Baner Road",
        contact_number: "9822099001",
        terms_and_conditions: "Terms",
        authorized_signature_name: "Rahul",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
      },
    ])

    const template = await getReceiptTemplate(DEMO_GYM.id)
    expect(template?.gymName).toBe("Iron Pulse Fitness")
    expect(template?.contactNumber).toBe("9822099001")
    expect(template?.logoUrl).toBeUndefined()
  })
})

describe("auth-users — Supabase mode", () => {
  beforeEach(() => {
    mock.seedTable("profiles", [
      {
        id: "user-1",
        name: "Rahul Deshmukh",
        avatar_url: null,
        email: "owner@ironpulse.com",
        role: "gym-owner",
        gym_id: DEMO_GYM.id,
        gym_name: DEMO_GYM.name,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "user-2",
        name: "Platform Admin",
        avatar_url: null,
        email: "admin@gymsos.demo",
        role: "super-admin",
        gym_id: null,
        gym_name: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ])
  })

  it("finds a user by email through the profiles table", async () => {
    const user = await findUserByEmail("OWNER@ironpulse.com")
    expect(user?.id).toBe("user-1")
    expect(user?.gymName).toBe(DEMO_GYM.name)
    // Passwords live in Supabase Auth, not the app.
    expect(user?.password).toBe("")
  })

  it("excludes a user by id (email-taken check)", async () => {
    expect(await findUserByEmail("owner@ironpulse.com", "user-1")).toBeUndefined()
    expect(await findUserByEmail("owner@ironpulse.com", "user-2")).toBeDefined()
  })

  it("finds the gym-owner account for a gym", async () => {
    const user = await findUserByGymId(DEMO_GYM.id)
    expect(user?.id).toBe("user-1")
    expect(await findUserByGymId("gym-other")).toBeUndefined()
  })

  it("creates an owner login through the invite edge function", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          userId: "user-new",
          email: "new@owner.in",
          name: "New Owner",
          role: "gym-owner",
          gymId: DEMO_GYM.id,
          gymName: DEMO_GYM.name,
        }),
      })
    vi.stubGlobal("fetch", fetchMock)

    const account = await upsertGymOwnerAccount({
      gymId: DEMO_GYM.id,
      gymName: DEMO_GYM.name,
      ownerName: "New Owner",
      email: "new@owner.in",
      password: "Owner@123",
    })

    expect(account.id).toBe("user-new")
    expect(account.email).toBe("new@owner.in")
    expect(account.role).toBe("gym-owner")
    expect(account.gymId).toBe(DEMO_GYM.id)
    expect(account.gymName).toBe(DEMO_GYM.name)
    // Supabase Auth owns the password in production mode.
    expect(account.password).toBe("")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(url).toBe(
      "https://mock.supabase.co/functions/v1/invite-gym-owner"
    )
    expect(init.method).toBe("POST")
    expect(headers["Content-Type"]).toBe("application/json")
    expect(headers.Authorization).toBe("Bearer test-access-token")
    expect(JSON.parse(init.body as string)).toEqual({
      gymId: DEMO_GYM.id,
      gymName: DEMO_GYM.name,
      ownerName: "New Owner",
      email: "new@owner.in",
      password: "Owner@123",
    })

    vi.unstubAllGlobals()
  })

  it("surfaces the edge function's error message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "That email already has a GymSOS account.",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      upsertGymOwnerAccount({
        gymId: DEMO_GYM.id,
        gymName: DEMO_GYM.name,
        ownerName: "New Owner",
        email: "taken@owner.in",
        password: "Owner@123",
      })
    ).rejects.toThrow("That email already has a GymSOS account.")

    vi.unstubAllGlobals()
  })
})

describe("notification reads — Supabase mode", () => {
  it("loads read markers for the user only", async () => {
    mock.seedTable("notification_reads", [
      { user_id: "user-1", notification_id: "n1" },
      { user_id: "user-1", notification_id: "n2" },
      { user_id: "user-2", notification_id: "n3" },
    ])

    expect(await loadNotificationReads("user-1")).toEqual(new Set(["n1", "n2"]))
    expect(await loadNotificationReads("user-2")).toEqual(new Set(["n3"]))
  })

  it("persists read markers as upserts", async () => {
    await persistNotificationRead("user-1", "n1")
    await persistNotificationReads("user-1", ["n2", "n3"])

    expect(mock.tableRows("notification_reads")).toHaveLength(3)
    expect(mock.tableRows("notification_reads").every((row) => row.user_id === "user-1")).toBe(true)
  })

  it("re-upserting an existing marker does not duplicate the row", async () => {
    await persistNotificationRead("user-1", "n1")
    await persistNotificationRead("user-1", "n1")

    expect(mock.tableRows("notification_reads")).toHaveLength(1)
  })
})
