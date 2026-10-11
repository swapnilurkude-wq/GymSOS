import { describe, expect, it } from "vitest"

import {
  OWNER_EXPIRY_TEMPLATE,
  OWNER_REMINDER_OFFSETS,
  ownerReminderDaysLabel,
  ownerReminderIdempotencyKey,
} from "../../supabase/functions/_shared/whatsapp/reminders"

/**
 * Stage 6 — the owner subscription-expiry
 * reminder contract. The SQL enqueuer
 * (enqueue_owner_subscription_reminders,
 * migration 0009) must stay in sync with
 * these constants; these tests pin the
 * contract.
 */

describe("owner reminder contract", () => {
  it("fires at 7, 3 and 0 days before the end date", () => {
    expect([...OWNER_REMINDER_OFFSETS]).toEqual([7, 3, 0])
  })

  it("uses the approved expiry template name", () => {
    expect(OWNER_EXPIRY_TEMPLATE).toBe(
      "gym_sos_subscription_expiry"
    )
  })

  it("labels the days until expiry", () => {
    expect(ownerReminderDaysLabel(7)).toBe("7 days")
    expect(ownerReminderDaysLabel(3)).toBe("3 days")
    expect(ownerReminderDaysLabel(0)).toBe("today")
  })

  it("builds idempotency keys that embed the end date", () => {
    const key = ownerReminderIdempotencyKey(
      "gym-123",
      7,
      "2026-10-20T00:00:00.000Z"
    )
    expect(key).toBe(
      "owner-reminder:gym-123:7:2026-10-20"
    )
  })

  it("changes the key when the subscription is renewed", () => {
    const before = ownerReminderIdempotencyKey(
      "gym-123",
      7,
      "2026-10-20T00:00:00.000Z"
    )
    const after = ownerReminderIdempotencyKey(
      "gym-123",
      7,
      "2026-11-20T00:00:00.000Z"
    )
    expect(after).not.toBe(before)
  })

  it("separates reminders for different offsets and gyms", () => {
    const seven = ownerReminderIdempotencyKey(
      "gym-123",
      7,
      "2026-10-20T00:00:00.000Z"
    )
    const three = ownerReminderIdempotencyKey(
      "gym-123",
      3,
      "2026-10-20T00:00:00.000Z"
    )
    const other = ownerReminderIdempotencyKey(
      "gym-456",
      7,
      "2026-10-20T00:00:00.000Z"
    )
    expect(seven).not.toBe(three)
    expect(seven).not.toBe(other)
  })
})
