import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * Stage 4 — the Super Admin messaging client
 * (src/lib/whatsapp-messaging.ts) against a
 * stub Supabase client that mirrors the query
 * shapes the real client supports.
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

    private matching() {
      return this.rows.filter((row) =>
        this.filters.every((f) => row[f.column] === f.value)
      )
    }

    async maybeSingle() {
      const matching = this.matching()
      return {
        data: matching[matching.length - 1] ?? null,
        error: null,
      }
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

    seed(table: string, rows: Record<string, unknown>[]) {
      this.tables.set(table, rows.map((row) => ({ ...row })))
    }

    from(table: string) {
      return new StubQuery(this.tables.get(table) ?? [])
    }

    async rpc(name: string, args: Record<string, unknown>) {
      this.rpcCalls.push({ name, args })
      return { data: true, error: null }
    }

    readonly auth = {
      getSession: async () => ({
        data: { session: { access_token: "user-jwt" } },
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
  getMessagingOverview,
  retryWhatsAppMessage,
  setGymMessagingPaused,
  setGlobalMessagingPaused,
} from "@/lib/whatsapp-messaging"

const NOW = new Date("2026-10-10T12:00:00.000Z")
const iso = (hoursOffset: number) =>
  new Date(NOW.getTime() + hoursOffset * 60 * 60 * 1000).toISOString()

function seedFixture() {
  mock.client.seed("message_outbox", [
    {
      id: "m1",
      gym_id: "g1",
      member_id: "mem1",
      owner_user_id: null,
      recipient_phone: "919820000000",
      category: "fitness_daily",
      template_name: "gym_sos_daily_tip",
      status: "sent",
      status_reason: "",
      scheduled_for: iso(-120),
      attempts: 1,
      provider_message_id: "p1",
      estimated_cost: 0.45,
      created_at: iso(-120),
      sent_at: iso(-119),
    },
    {
      id: "m2",
      gym_id: "g1",
      member_id: "mem1",
      owner_user_id: null,
      recipient_phone: "919820000000",
      category: "membership_expiry",
      template_name: "gym_sos_membership_expiry",
      status: "failed",
      status_reason: "Invalid template",
      scheduled_for: iso(-60),
      attempts: 1,
      provider_message_id: "",
      estimated_cost: 0,
      created_at: iso(-60),
      sent_at: null,
    },
    {
      id: "m3",
      gym_id: "g1",
      member_id: "mem2",
      owner_user_id: null,
      recipient_phone: "919811111111",
      category: "membership_expiry",
      template_name: "gym_sos_membership_expiry",
      status: "suppressed",
      status_reason: "owner_subscription_inactive",
      scheduled_for: iso(-30),
      attempts: 1,
      provider_message_id: "",
      estimated_cost: 0,
      created_at: iso(-30),
      sent_at: null,
    },
    {
      id: "m4",
      gym_id: "g2",
      member_id: "mem3",
      owner_user_id: null,
      recipient_phone: "919833333333",
      category: "fitness_daily",
      template_name: "gym_sos_daily_tip",
      status: "pending",
      status_reason: "",
      scheduled_for: iso(-15),
      attempts: 0,
      provider_message_id: "",
      estimated_cost: 0,
      created_at: iso(-15),
      sent_at: null,
    },
    // Outside the 30-day stats window — must
    // not count.
    {
      id: "old",
      gym_id: "g1",
      member_id: null,
      owner_user_id: "owner1",
      recipient_phone: "919820000000",
      category: "owner_subscription_expiry",
      template_name: "gym_sos_subscription_expiry",
      status: "sent",
      status_reason: "",
      scheduled_for: "2025-01-01T00:00:00.000Z",
      attempts: 1,
      provider_message_id: "p-old",
      estimated_cost: 0.45,
      created_at: "2025-01-01T00:00:00.000Z",
      sent_at: "2025-01-01T00:05:00.000Z",
    },
  ])
  mock.client.seed("platform_messaging_controls", [
    {
      id: "controls-1",
      global_paused: true,
      daily_send_cap: 250,
      business_hours_start: "09:00:00",
      business_hours_end: "20:00:00",
      timezone: "Asia/Kolkata",
      updated_at: iso(0),
    },
  ])
  mock.client.seed("gyms", [
    { id: "g1", name: "Iron Pulse", status: "active" },
    { id: "g2", name: "Fitness Factory", status: "trial" },
  ])
  mock.client.seed("gym_messaging_settings", [
    {
      gym_id: "g2",
      membership_expiry_reminders: false,
      daily_fitness_messages: false,
      paused: true,
      default_preferred_time: "09:00:00",
      updated_at: iso(0),
    },
  ])
}

describe("messaging client — overview", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    mock.configured = true
  })

  it("maps rows to stats, the log, controls and per-gym pause state", async () => {
    seedFixture()

    const overview = await getMessagingOverview()

    // Stats cover the rolling 30-day window:
    // m1 sent, m2 failed, m3 suppressed,
    // m4 pending — "old" is excluded.
    expect(overview.stats).toEqual({
      total: 4,
      sent: 1,
      delivered: 0,
      failed: 1,
      suppressed: 1,
      cancelled: 0,
      pending: 1,
      estimatedCost: 0.45,
    })

    // The log is newest-first.
    expect(overview.log.slice(0, 4).map((m) => m.id)).toEqual([
      "m4",
      "m3",
      "m2",
      "m1",
    ])
    expect(overview.log[0]).toMatchObject({
      id: "m4",
      gymId: "g2",
      memberId: "mem3",
      ownerUserId: null,
      recipientPhone: "919833333333",
      category: "fitness_daily",
      templateName: "gym_sos_daily_tip",
      status: "pending",
      statusReason: "",
      attempts: 0,
      estimatedCost: 0,
    })

    expect(overview.controls).toEqual({
      globalPaused: true,
      dailySendCap: 250,
      businessHoursStart: "09:00:00",
      businessHoursEnd: "20:00:00",
      timezone: "Asia/Kolkata",
    })

    // Per-gym pause merges the gyms with their
    // settings rows (g2 paused, g1 default off).
    expect(overview.gyms).toEqual([
      {
        gymId: "g1",
        gymName: "Iron Pulse",
        gymStatus: "active",
        paused: false,
      },
      {
        gymId: "g2",
        gymName: "Fitness Factory",
        gymStatus: "trial",
        paused: true,
      },
    ])
  })
})

describe("messaging client — pause toggles", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    mock.configured = true
  })

  it("toggles the global pause through the RPC", async () => {
    await setGlobalMessagingPaused(true)
    expect(mock.client.rpcCalls).toContainEqual({
      name: "set_global_messaging_paused",
      args: { p_paused: true },
    })
  })

  it("toggles a gym's pause through the RPC", async () => {
    await setGymMessagingPaused("g1", false)
    expect(mock.client.rpcCalls).toContainEqual({
      name: "set_gym_messaging_paused",
      args: { p_gym_id: "g1", p_paused: false },
    })
  })
})

describe("messaging client — manual retry", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    mock.configured = true
  })

  it("posts the message id to the retry function with the session token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        outcome: "sent",
        reason: "",
        providerMessageId: "p-retry",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await retryWhatsAppMessage("m2")

    expect(result).toEqual({
      outcome: "sent",
      reason: "",
      providerMessageId: "p-retry",
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit
    ]
    expect(url).toBe(
      "https://mock.supabase.co/functions/v1/whatsapp-retry"
    )
    expect(init.method).toBe("POST")
    expect(
      (init.headers as Record<string, string>).Authorization
    ).toBe("Bearer user-jwt")
    expect(JSON.parse(init.body as string)).toEqual({
      message_id: "m2",
    })
  })

  it("surfaces the function's error message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: "Only failed messages can be retried.",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(retryWhatsAppMessage("m3")).rejects.toThrow(
      "Only failed messages can be retried."
    )
  })
})

describe("messaging client — demo mode", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    mock.configured = true
  })

  it("reads report an empty overview", async () => {
    mock.configured = false
    const overview = await getMessagingOverview()
    expect(overview.log).toEqual([])
    expect(overview.gyms).toEqual([])
    expect(overview.stats.total).toBe(0)
  })

  it("mutations are refused", async () => {
    mock.configured = false
    await expect(setGlobalMessagingPaused(true)).rejects.toThrow(
      /demo mode/
    )
    await expect(setGymMessagingPaused("g1", true)).rejects.toThrow(
      /demo mode/
    )
    await expect(retryWhatsAppMessage("m2")).rejects.toThrow(
      /demo mode/
    )
  })
})
