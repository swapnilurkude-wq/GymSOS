import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * Stage 5 — the gym-owner WhatsApp client
 * (src/lib/owner-whatsapp.ts) against a
 * stub Supabase client.
 */

const mock = vi.hoisted(() => {
  class StubQuery {
    private filters: Array<{ column: string; value: unknown }> = []
    private readonly rows: Record<string, unknown>[]

    constructor(rows: Record<string, unknown>[]) {
      this.rows = rows
    }

    select(_columns?: string) {
      return this
    }

    eq(column: string, value: unknown) {
      this.filters.push({ column, value })
      return this
    }

    order(_column: string, _options?: Record<string, unknown>) {
      return this
    }

    limit(_count: number) {
      return this
    }

    upsert(payload: Record<string, unknown>) {
      const existing = this.rows.find((row) =>
        Object.entries(payload).every(
          ([key, value]) => row[key] === value
        )
      )
      if (existing) {
        Object.assign(existing, payload)
      } else {
        this.rows.push({ ...payload })
      }
      return Promise.resolve({ data: null, error: null })
    }

    private matching() {
      return this.rows.filter((row) =>
        this.filters.every((f) => row[f.column] === f.value)
      )
    }

    async maybeSingle() {
      const matching = this.matching()
      return { data: matching[0] ?? null, error: null }
    }

    then<T>(
      onFulfilled?:
        | ((value: {
            data: Record<string, unknown>[]
            error: null
          }) => T | PromiseLike<T>)
        | null,
      onRejected?: ((reason: unknown) => T | PromiseLike<T>) | null
    ) {
      return Promise.resolve({
        data: this.matching(),
        error: null,
      }).then(onFulfilled, onRejected)
    }
  }

  class StubClient {
    readonly tables = new Map<string, Record<string, unknown>[]>()
    readonly rpcCalls: Array<{
      name: string
      args: Record<string, unknown>
    }> = []
    readonly upserts: Array<{
      table: string
      payload: Record<string, unknown>
    }> = []

    seed(table: string, rows: Record<string, unknown>[]) {
      this.tables.set(table, rows.map((row) => ({ ...row })))
    }

    from(table: string) {
      const query = new StubQuery(this.tables.get(table) ?? [])
      return {
        select: (columns?: string) => query.select(columns),
        upsert: (payload: Record<string, unknown>) => {
          this.upserts.push({ table, payload })
          return query.upsert(payload)
        },
      }
    }

    async rpc(name: string, args: Record<string, unknown>) {
      this.rpcCalls.push({ name, args })
      return { data: true, error: null }
    }

    readonly auth = {
      getSession: async () => ({
        data: {
          session: {
            access_token: "owner-jwt",
            user: { id: "owner-1" },
          },
        },
        error: null,
      }),
    }
  }

  const client = new StubClient()
  return { client, configured: true }
})

vi.mock("@/lib/supabase", () => ({
  SUPABASE_URL: "https://mock.supabase.co",
  SUPABASE_ANON_KEY: "mock-anon-key",
  isSupabaseConfigured: () => mock.configured,
  getSupabase: () => mock.client,
}))

import {
  getMemberWhatsAppOptin,
  getOwnerMessageHistory,
  getOwnerWhatsAppSettings,
  requestWhatsAppVerificationCode,
  saveMemberWhatsAppOptin,
  saveOwnerWhatsAppSettings,
  verifyWhatsAppCode,
} from "@/lib/owner-whatsapp"

describe("owner whatsapp client — settings", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    mock.configured = true
    mock.client.rpcCalls.length = 0
    mock.client.upserts.length = 0
  })

  it("reads and maps the owner's settings row", async () => {
    mock.client.seed("gym_owner_whatsapp", [
      {
        user_id: "owner-1",
        whatsapp_number: "919820000000",
        is_verified: true,
        verified_at: "2026-10-10T09:00:00.000Z",
        fitness_daily: true,
        membership_expiry: true,
        service_reminders: false,
        preferred_time: "18:30:00",
        timezone: "Asia/Kolkata",
      },
    ])

    const settings = await getOwnerWhatsAppSettings()

    expect(settings).toEqual({
      whatsappNumber: "919820000000",
      isVerified: true,
      verifiedAt: "2026-10-10T09:00:00.000Z",
      fitnessDaily: true,
      membershipExpiry: true,
      serviceReminders: false,
      preferredTime: "18:30:00",
      timezone: "Asia/Kolkata",
    })
  })

  it("returns the defaults when the owner has no row yet", async () => {
    mock.client.seed("gym_owner_whatsapp", [])

    const settings = await getOwnerWhatsAppSettings()

    expect(settings).toEqual({
      whatsappNumber: "",
      isVerified: false,
      verifiedAt: null,
      fitnessDaily: false,
      membershipExpiry: false,
      serviceReminders: false,
      preferredTime: "09:00:00",
      timezone: "Asia/Kolkata",
    })
  })

  it("saves settings through the RPC", async () => {
    await saveOwnerWhatsAppSettings({
      whatsappNumber: "919820000000",
      fitnessDaily: true,
      membershipExpiry: false,
      serviceReminders: true,
      preferredTime: "19:00:00",
      timezone: "Asia/Kolkata",
    })

    expect(mock.client.rpcCalls).toContainEqual({
      name: "save_owner_whatsapp_settings",
      args: {
        p_whatsapp_number: "919820000000",
        p_fitness_daily: true,
        p_membership_expiry: false,
        p_service_reminders: true,
        p_preferred_time: "19:00:00",
        p_timezone: "Asia/Kolkata",
      },
    })
  })
})

describe("owner whatsapp client — verification", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    mock.configured = true
  })

  it("requests a code via the verify function", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sent: true, whatsappNumber: "919820000000" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await requestWhatsAppVerificationCode("919820000000")

    expect(result).toEqual({ whatsappNumber: "919820000000" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      "https://mock.supabase.co/functions/v1/whatsapp-owner-verify"
    )
    expect(init.method).toBe("POST")
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer owner-jwt"
    )
    expect(JSON.parse(init.body as string)).toEqual({
      action: "send_code",
      whatsapp_number: "919820000000",
    })
  })

  it("verifies a code via the verify function", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ verified: true, whatsappNumber: "919820000000" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await verifyWhatsAppCode("482913")

    expect(result).toEqual({ whatsappNumber: "919820000000" })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({
      action: "verify",
      code: "482913",
    })
  })

  it("surfaces the function's error message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: "Please wait a minute before requesting another code.",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      requestWhatsAppVerificationCode("919820000000")
    ).rejects.toThrow(
      "Please wait a minute before requesting another code."
    )
  })
})

describe("owner whatsapp client — history and member opt-ins", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    mock.configured = true
    mock.client.rpcCalls.length = 0
    mock.client.upserts.length = 0
  })

  it("reads the gym's message history", async () => {
    mock.client.seed("message_outbox", [
      {
        id: "m1",
        recipient_phone: "919820000000",
        category: "owner_subscription_expiry",
        template_name: "gym_sos_subscription_expiry",
        status: "sent",
        status_reason: "",
        scheduled_for: "2026-10-10T07:00:00.000Z",
        sent_at: "2026-10-10T09:01:00.000Z",
        created_at: "2026-10-10T07:00:00.000Z",
      },
    ])

    const history = await getOwnerMessageHistory()

    expect(history).toEqual([
      {
        id: "m1",
        recipientPhone: "919820000000",
        category: "owner_subscription_expiry",
        templateName: "gym_sos_subscription_expiry",
        status: "sent",
        statusReason: "",
        scheduledFor: "2026-10-10T07:00:00.000Z",
        sentAt: "2026-10-10T09:01:00.000Z",
        createdAt: "2026-10-10T07:00:00.000Z",
      },
    ])
  })

  it("reads a member's opt-in", async () => {
    mock.client.seed("member_whatsapp_optins", [
      {
        member_id: "member-1",
        gym_id: "gym-1",
        whatsapp_number: "919811111111",
        opted_in: true,
        fitness_daily: true,
        membership_expiry: false,
        preferred_time: "10:00:00",
      },
    ])

    const optin = await getMemberWhatsAppOptin("member-1")

    expect(optin).toEqual({
      whatsappNumber: "919811111111",
      optedIn: true,
      fitnessDaily: true,
      membershipExpiry: false,
      preferredTime: "10:00:00",
    })
  })

  it("returns null when a member has no opt-in row", async () => {
    mock.client.seed("member_whatsapp_optins", [])

    const optin = await getMemberWhatsAppOptin("member-1")

    expect(optin).toBeNull()
  })

  it("upserts an opt-in with the opted-out timestamp on opt-out", async () => {
    mock.client.seed("member_whatsapp_optins", [])

    await saveMemberWhatsAppOptin("member-1", "gym-1", {
      whatsappNumber: "919811111111",
      optedIn: false,
      fitnessDaily: false,
      membershipExpiry: false,
      preferredTime: "09:00:00",
    })

    expect(mock.client.upserts).toHaveLength(1)
    const { table, payload } = mock.client.upserts[0]
    expect(table).toBe("member_whatsapp_optins")
    expect(payload.member_id).toBe("member-1")
    expect(payload.gym_id).toBe("gym-1")
    expect(payload.opted_in).toBe(false)
    expect(payload.opted_out_at).not.toBeNull()
  })

  it("clears the opted-out timestamp on opt-in", async () => {
    mock.client.seed("member_whatsapp_optins", [])

    await saveMemberWhatsAppOptin("member-1", "gym-1", {
      whatsappNumber: "919811111111",
      optedIn: true,
      fitnessDaily: true,
      membershipExpiry: true,
      preferredTime: "09:00:00",
    })

    const { payload } = mock.client.upserts[0]
    expect(payload.opted_in).toBe(true)
    expect(payload.opted_out_at).toBeNull()
    expect(payload.fitness_daily).toBe(true)
    expect(payload.membership_expiry).toBe(true)
  })
})

describe("owner whatsapp client — demo mode", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    mock.configured = true
  })

  it("reads report defaults and empty lists", async () => {
    mock.configured = false

    const settings = await getOwnerWhatsAppSettings()
    const history = await getOwnerMessageHistory()
    const optin = await getMemberWhatsAppOptin("member-1")

    expect(settings.whatsappNumber).toBe("")
    expect(history).toEqual([])
    expect(optin).toBeNull()
  })

  it("mutations are refused", async () => {
    mock.configured = false

    await expect(
      saveOwnerWhatsAppSettings({
        whatsappNumber: "919820000000",
        fitnessDaily: false,
        membershipExpiry: false,
        serviceReminders: false,
        preferredTime: "09:00:00",
        timezone: "Asia/Kolkata",
      })
    ).rejects.toThrow(/demo mode/)

    await expect(
      saveMemberWhatsAppOptin("member-1", "gym-1", {
        whatsappNumber: "919811111111",
        optedIn: true,
        fitnessDaily: false,
        membershipExpiry: false,
        preferredTime: "09:00:00",
      })
    ).rejects.toThrow(/demo mode/)

    await expect(
      requestWhatsAppVerificationCode("919820000000")
    ).rejects.toThrow(/demo mode/)

    await expect(verifyWhatsAppCode("482913")).rejects.toThrow(
      /demo mode/
    )
  })
})
