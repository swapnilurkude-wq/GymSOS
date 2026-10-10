import { afterEach, describe, expect, it, vi } from "vitest"

import {
  dispatchMessage,
} from "../../supabase/functions/_shared/whatsapp/dispatch"
import { encryptSecret } from "../../supabase/functions/_shared/whatsapp/crypto"
import type { DbResult } from "../../supabase/functions/_shared/whatsapp/dispatch"

/**
 * Stage 3 dispatch tests — the scheduler's send
 * path, exercised against a stub client that
 * emulates the atomic claim semantics of the
 * 0006 SQL functions (claim_message_by_id,
 * claim_due_message, count_messages_sent_today,
 * retry_message, cancel_stale_messages).
 *
 * Business hours in the fixture span the whole
 * day so the real clock never flakes the tests;
 * the deferral path is driven deterministically
 * through the daily send cap (counted by the
 * stub).
 */

const FIXED_NOW = new Date("2026-10-10T12:00:00.000Z")
const ENCRYPTION_KEY = "test-encryption-key"

class StubQuery {
  private filters: Array<{ column: string; value: unknown }> = []
  private readonly db: StubDb
  private readonly table: string

  constructor(db: StubDb, table: string) {
    this.db = db
    this.table = table
  }

  select(_columns?: string) {
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value })
    return this
  }

  async maybeSingle(): Promise<DbResult> {
    const rows = (this.db.tables.get(this.table) ?? []).filter(
      (row) =>
        this.filters.every((f) => row[f.column] === f.value)
    )
    return { data: rows[0] ?? null, error: null }
  }

  update(values: Record<string, unknown>) {
    return {
      eq: async (
        column: string,
        value: unknown
      ): Promise<DbResult> => {
        for (const row of this.db.tables.get(this.table) ?? []) {
          if (row[column] === value) {
            Object.assign(row, values)
          }
        }
        return { data: null, error: null }
      },
    }
  }

  async insert(
    values: Record<string, unknown>
  ): Promise<DbResult> {
    this.db.tables.get(this.table)?.push({ ...values })
    return { data: null, error: null }
  }
}

class StubDb {
  readonly tables = new Map<string, Record<string, unknown>[]>()
  now = FIXED_NOW
  /** Table (or "rpc:<name>") whose reads should throw. */
  failOnTable: string | null = null

  row<T>(table: string, id: string): T | undefined {
    return (this.tables.get(table) ?? []).find(
      (r) => r.id === id
    ) as T | undefined
  }

  from(table: string) {
    if (this.failOnTable === table) {
      throw new Error(`stub read failure on ${table}`)
    }
    return new StubQuery(this, table)
  }

  async rpc(
    name: string,
    params: Record<string, unknown>
  ): Promise<DbResult> {
    if (this.failOnTable === `rpc:${name}`) {
      throw new Error(`stub rpc failure on ${name}`)
    }
    const outbox = () => this.tables.get("message_outbox") ?? []

    switch (name) {
      case "claim_message_by_id": {
        const row = this.row<Record<string, unknown>>(
          "message_outbox",
          params.p_message_id as string
        )
        if (
          row &&
          (row.status === "scheduled" || row.status === "pending")
        ) {
          Object.assign(row, {
            status: "sending",
            attempts: (row.attempts as number) + 1,
            last_attempt_at: this.now.toISOString(),
          })
          return { data: true, error: null }
        }
        return { data: false, error: null }
      }

      case "claim_due_message": {
        const cutoff15m = new Date(
          this.now.getTime() - 15 * 60 * 1000
        ).toISOString()
        const due = outbox()
          .filter((r) => {
            const dueNow =
              (r.scheduled_for as string) <= this.now.toISOString()
            const pending =
              (r.status === "scheduled" || r.status === "pending") &&
              dueNow
            const failedRetry =
              r.status === "failed" &&
              (r.attempts as number) < 3 &&
              (r.last_attempt_at as string) <= cutoff15m
            return pending || failedRetry
          })
          .sort((a, b) =>
            String(a.scheduled_for).localeCompare(
              String(b.scheduled_for)
            )
          )
        const next = due[0]
        if (!next) return { data: null, error: null }
        Object.assign(next, {
          status: "sending",
          attempts: (next.attempts as number) + 1,
          last_attempt_at: this.now.toISOString(),
        })
        return { data: next.id, error: null }
      }

      case "count_messages_sent_today": {
        return {
          data: outbox().filter(
            (r) => r.status === "sent" || r.status === "delivered"
          ).length,
          error: null,
        }
      }

      case "cancel_stale_messages": {
        const cutoff = new Date(
          this.now.getTime() - 7 * 24 * 60 * 60 * 1000
        ).toISOString()
        let count = 0
        for (const r of outbox()) {
          if (
            (r.status === "scheduled" || r.status === "pending") &&
            (r.scheduled_for as string) <= cutoff
          ) {
            Object.assign(r, {
              status: "cancelled",
              status_reason: "stale",
            })
            count++
          }
        }
        return { data: count, error: null }
      }

      case "retry_message": {
        const row = this.row<Record<string, unknown>>(
          "message_outbox",
          params.p_message_id as string
        )
        if (!row || row.status !== "failed") {
          return { data: false, error: null }
        }
        Object.assign(row, {
          status: "pending",
          status_reason: "",
          attempts: 0,
        })
        this.tables.get("message_events")?.push({
          message_id: row.id,
          event_type: "retried",
          detail: { retried_by: params.p_retried_by },
        })
        return { data: true, error: null }
      }

      default:
        return { data: null, error: null }
    }
  }
}

async function buildFixture(overrides: {
  tables?: Record<string, Record<string, unknown>[]>
  message?: Record<string, unknown>
} = {}) {
  const db = new StubDb()

  const tables: Record<string, Record<string, unknown>[]> = {
    whatsapp_provider_config: [
      {
        provider: "meta-cloud-api",
        phone_number_id: "12345",
        business_account_id: "",
        encrypted_access_token: await encryptSecret(
          "meta-access-token",
          ENCRYPTION_KEY
        ),
        encrypted_webhook_secret: null,
        test_recipient_phone: "919820000000",
        is_configured: true,
        is_active: true,
        last_error: null,
        last_tested_at: null,
        tested_by: null,
      },
    ],
    platform_messaging_controls: [
      {
        global_paused: false,
        daily_send_cap: 500,
        business_hours_start: "00:00:00",
        business_hours_end: "23:59:59",
        timezone: "Asia/Kolkata",
      },
    ],
    gyms: [
      {
        id: "gym-1",
        status: "active",
        subscription_end_date: "2026-11-10T00:00:00.000Z",
      },
    ],
    gym_messaging_settings: [
      {
        gym_id: "gym-1",
        membership_expiry_reminders: true,
        daily_fitness_messages: true,
        paused: false,
        default_preferred_time: "09:00:00",
        updated_at: FIXED_NOW.toISOString(),
      },
    ],
    members: [
      {
        id: "member-1",
        gym_id: "gym-1",
        end_date: "2026-10-13T00:00:00.000Z",
      },
    ],
    member_whatsapp_optins: [
      {
        member_id: "member-1",
        gym_id: "gym-1",
        whatsapp_number: "919820000000",
        opted_in: true,
        fitness_daily: true,
        membership_expiry: true,
        opted_in_at: FIXED_NOW.toISOString(),
        opted_out_at: null,
        preferred_time: "09:00:00",
        timezone: "Asia/Kolkata",
        created_at: FIXED_NOW.toISOString(),
        updated_at: FIXED_NOW.toISOString(),
      },
    ],
    profiles: [
      {
        id: "owner-1",
        role: "gym-owner",
      },
    ],
    gym_owner_whatsapp: [
      {
        user_id: "owner-1",
        whatsapp_number: "919820000000",
        is_verified: true,
        verified_at: FIXED_NOW.toISOString(),
        fitness_daily: false,
        membership_expiry: false,
        service_reminders: true,
        preferred_time: "09:00:00",
        timezone: "Asia/Kolkata",
        created_at: FIXED_NOW.toISOString(),
        updated_at: FIXED_NOW.toISOString(),
      },
    ],
    message_outbox: [
      {
        id: "msg-1",
        idempotency_key: "key-1",
        gym_id: "gym-1",
        member_id: "member-1",
        owner_user_id: null,
        recipient_phone: "919820000000",
        category: "fitness_daily",
        template_name: "gym_sos_daily_tip",
        template_params: { "1": "Aarav" },
        status: "pending",
        status_reason: "",
        scheduled_for: "2026-10-10T07:00:00.000Z",
        attempts: 0,
        last_attempt_at: null,
        provider_message_id: "",
        estimated_cost: 0,
        created_at: FIXED_NOW.toISOString(),
        updated_at: FIXED_NOW.toISOString(),
        sent_at: null,
      },
    ],
    message_events: [],
    ...overrides.tables,
  }

  for (const [name, rows] of Object.entries(tables)) {
    db.tables.set(name, rows)
  }

  if (overrides.message) {
    const outbox = db.tables.get("message_outbox")!
    outbox[0] = { ...outbox[0], ...overrides.message }
  }

  return db
}

function outboxRow(db: StubDb) {
  return db.row<Record<string, unknown>>("message_outbox", "msg-1")!
}

function events(db: StubDb) {
  return db.tables.get("message_events") ?? []
}

describe("dispatch — eligible member message", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("sends through the provider and records the outcome", async () => {
    const db = await buildFixture()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "msg-abc" }] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await dispatchMessage(db, "msg-1", {
      encryptionKey: ENCRYPTION_KEY,
      now: FIXED_NOW,
    })

    expect(result).toEqual({
      outcome: "sent",
      reason: "",
      providerMessageId: "msg-abc",
    })

    // The provider call carries the recipient, the
    // approved template and the decrypted token.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit
    ]
    expect(url).toBe(
      "https://graph.facebook.com/v21.0/12345/messages"
    )
    expect(
      (init.headers as Record<string, string>).Authorization
    ).toBe("Bearer meta-access-token")
    const body = JSON.parse(init.body as string)
    expect(body.to).toBe("919820000000")
    expect(body.template.name).toBe("gym_sos_daily_tip")
    expect(body.template.components[0].parameters).toEqual([
      { type: "text", text: "Aarav" },
    ])

    // The outbox row and the audit log are updated.
    const row = outboxRow(db)
    expect(row.status).toBe("sent")
    expect(row.provider_message_id).toBe("msg-abc")
    expect(row.sent_at).toBe(FIXED_NOW.toISOString())
    expect(events(db)).toHaveLength(1)
    expect(events(db)[0].event_type).toBe("sent")
  })
})

describe("dispatch — the critical subscription rule", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("blocks member messages when the owner subscription just expired", async () => {
    const db = await buildFixture({
      tables: {
        gyms: [
          {
            id: "gym-1",
            status: "active",
            subscription_end_date: "2026-10-09T00:00:00.000Z",
          },
        ],
      },
    })
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await dispatchMessage(db, "msg-1", {
      encryptionKey: ENCRYPTION_KEY,
      now: FIXED_NOW,
    })

    expect(result).toEqual({
      outcome: "suppressed",
      reason: "owner_subscription_inactive",
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(outboxRow(db).status).toBe("suppressed")
    expect(outboxRow(db).status_reason).toBe(
      "owner_subscription_inactive"
    )
  })

  it("still delivers the owner's own renewal reminder for that expired gym", async () => {
    const db = await buildFixture({
      tables: {
        gyms: [
          {
            id: "gym-1",
            status: "active",
            subscription_end_date: "2026-10-09T00:00:00.000Z",
          },
        ],
      },
      message: {
        member_id: null,
        owner_user_id: "owner-1",
        category: "owner_subscription_expiry",
        template_name: "gym_sos_subscription_expiry",
        template_params: {},
        recipient_phone: "919820000000",
      },
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "msg-xyz" }] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await dispatchMessage(db, "msg-1", {
      encryptionKey: ENCRYPTION_KEY,
      now: FIXED_NOW,
    })

    expect(result.outcome).toBe("sent")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(outboxRow(db).status).toBe("sent")
  })
})

describe("dispatch — deferral, failure and safety", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("releases a message back to pending when the daily cap is reached (deferred, not suppressed)", async () => {
    const sentRow = {
      ...((await buildFixture()).row<Record<string, unknown>>(
        "message_outbox",
        "msg-1"
      ) as Record<string, unknown>),
    }
    const db = await buildFixture({
      tables: {
        platform_messaging_controls: [
          {
            global_paused: false,
            daily_send_cap: 1,
            business_hours_start: "00:00:00",
            business_hours_end: "23:59:59",
            timezone: "Asia/Kolkata",
          },
        ],
        message_outbox: [
          // One message already delivered today…
          { ...sentRow, id: "msg-0", status: "sent", sent_at: FIXED_NOW.toISOString() },
          // …and the one being dispatched.
          { ...sentRow, id: "msg-1", status: "pending" },
        ],
      },
    })
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await dispatchMessage(db, "msg-1", {
      encryptionKey: ENCRYPTION_KEY,
      now: FIXED_NOW,
    })

    expect(result).toEqual({
      outcome: "deferred",
      reason: "daily_send_cap_reached",
      isDeferrable: true,
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(outboxRow(db).status).toBe("pending")
    // No events — a deferral is not an outcome.
    expect(events(db)).toHaveLength(0)
  })

  it("marks a message failed when the provider errors, so it can be retried", async () => {
    const db = await buildFixture()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { message: "Invalid template", code: 131048 },
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await dispatchMessage(db, "msg-1", {
      encryptionKey: ENCRYPTION_KEY,
      now: FIXED_NOW,
    })

    expect(result.outcome).toBe("failed")
    expect(result.reason).toBe("Invalid template")
    expect(outboxRow(db).status).toBe("failed")
    expect(outboxRow(db).status_reason).toBe("Invalid template")
    expect(outboxRow(db).attempts).toBe(1)
    expect(events(db).some((e) => e.event_type === "failed")).toBe(
      true
    )
  })

  it("dry-run evaluates eligibility without sending or writing anything", async () => {
    const db = await buildFixture()
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await dispatchMessage(db, "msg-1", {
      dryRun: true,
      encryptionKey: ENCRYPTION_KEY,
      now: FIXED_NOW,
    })

    expect(result).toEqual({
      outcome: "sent",
      reason: "",
      isDeferrable: false,
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(outboxRow(db).status).toBe("pending")
    expect(events(db)).toHaveLength(0)
  })

  it("skips a row another worker already handled", async () => {
    const db = await buildFixture({
      message: { status: "sent" },
    })
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await dispatchMessage(db, "msg-1", {
      encryptionKey: ENCRYPTION_KEY,
      now: FIXED_NOW,
    })

    expect(result).toEqual({
      outcome: "skipped",
      reason: "already_claimed_or_not_claimable",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("never leaves a row stuck in sending when something unexpected fails", async () => {
    const db = await buildFixture()
    db.failOnTable = "gym_messaging_settings"
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await dispatchMessage(db, "msg-1", {
      encryptionKey: ENCRYPTION_KEY,
      now: FIXED_NOW,
    })

    expect(result.outcome).toBe("failed")
    expect(result.reason).toMatch(/^dispatch_error:/)
    expect(outboxRow(db).status).toBe("failed")
  })

  it("retries a failed message: re-queued, re-checked, then sent", async () => {
    const db = await buildFixture({
      message: { status: "failed", attempts: 1, status_reason: "Invalid template" },
    })

    // The retry RPC re-queues the SAME row.
    const { data: requeued } = await db.rpc("retry_message", {
      p_message_id: "msg-1",
      p_retried_by: "admin-1",
    })
    expect(requeued).toBe(true)
    expect(outboxRow(db).status).toBe("pending")
    expect(outboxRow(db).attempts).toBe(0)

    // The immediate dispatch then claims and sends it.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "msg-retry" }] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await dispatchMessage(db, "msg-1", {
      encryptionKey: ENCRYPTION_KEY,
      now: FIXED_NOW,
    })

    expect(result).toEqual({
      outcome: "sent",
      reason: "",
      providerMessageId: "msg-retry",
    })
    expect(outboxRow(db).status).toBe("sent")
    expect(
      events(db).some((e) => e.event_type === "retried")
    ).toBe(true)
    expect(
      events(db).some((e) => e.event_type === "sent")
    ).toBe(true)
  })

  it("refuses to retry a suppressed message (stays suppressed with its reason)", async () => {
    const db = await buildFixture({
      message: {
        status: "suppressed",
        status_reason: "member_unsubscribed",
      },
    })

    const { data: requeued } = await db.rpc("retry_message", {
      p_message_id: "msg-1",
      p_retried_by: "admin-1",
    })

    expect(requeued).toBe(false)
    expect(outboxRow(db).status).toBe("suppressed")
    expect(outboxRow(db).status_reason).toBe("member_unsubscribed")
  })

  it("the scheduler's claim picks due messages oldest-first and skips future ones", async () => {
    const db = await buildFixture({
      message: { id: "msg-1", scheduled_for: "2026-10-11T07:00:00.000Z" },
    })
    // A due message scheduled before the future one.
    db.tables.get("message_outbox")!.push({
      ...outboxRow(db),
      id: "msg-0",
      scheduled_for: "2026-10-10T06:00:00.000Z",
    })

    const { data: first } = await db.rpc("claim_due_message", {})
    expect(first).toBe("msg-0")

    // The future message is not claimable yet.
    const { data: next } = await db.rpc("claim_due_message", {})
    expect(next).toBeNull()
  })
})
