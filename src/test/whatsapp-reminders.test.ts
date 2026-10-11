import { describe, expect, it } from "vitest"

import {
  DAILY_FITNESS_TIP_COUNT,
  FITNESS_DAILY_TEMPLATE,
  MEMBER_EXPIRY_TEMPLATE,
  MEMBER_REMINDER_OFFSETS,
  OWNER_EXPIRY_TEMPLATE,
  OWNER_REMINDER_OFFSETS,
  fitnessDailyIdempotencyKey,
  membershipReminderIdempotencyKey,
  ownerReminderIdempotencyKey,
  reminderDaysLabel,
} from "../../supabase/functions/_shared/whatsapp/reminders"

/**
 * Stage 6/7 — the expiry reminder
 * contract. The SQL enqueuers
 * (enqueue_owner_subscription_reminders
 * and enqueue_membership_expiry_
 * reminders, migrations 0009 / 0010)
 * must stay in sync with these
 * constants; these tests pin the
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

describe("member reminder contract", () => {
  it("fires at 7, 3 and 0 days before the membership end date", () => {
    expect([...MEMBER_REMINDER_OFFSETS]).toEqual([7, 3, 0])
  })

  it("uses the approved membership expiry template name", () => {
    expect(MEMBER_EXPIRY_TEMPLATE).toBe(
      "gym_sos_membership_expiry"
    )
  })

  it("builds idempotency keys that embed the end date", () => {
    const key = membershipReminderIdempotencyKey(
      "member-1",
      3,
      "2026-10-20T00:00:00.000Z"
    )
    expect(key).toBe(
      "membership-reminder:member-1:3:2026-10-20"
    )
  })

  it("changes the key when the membership is renewed", () => {
    const before = membershipReminderIdempotencyKey(
      "member-1",
      7,
      "2026-10-20T00:00:00.000Z"
    )
    const after = membershipReminderIdempotencyKey(
      "member-1",
      7,
      "2026-11-20T00:00:00.000Z"
    )
    expect(after).not.toBe(before)
  })

  it("separates member reminders from owner reminders", () => {
    const member = membershipReminderIdempotencyKey(
      "gym-123",
      7,
      "2026-10-20T00:00:00.000Z"
    )
    const owner = ownerReminderIdempotencyKey(
      "gym-123",
      7,
      "2026-10-20T00:00:00.000Z"
    )
    expect(member).not.toBe(owner)
  })
})

describe("reminder days label", () => {
  it("labels the days until expiry", () => {
    expect(reminderDaysLabel(7)).toBe("7 days")
    expect(reminderDaysLabel(3)).toBe("3 days")
    expect(reminderDaysLabel(0)).toBe("today")
  })
})

describe("daily fitness contract", () => {
  it("uses the approved daily fitness template name", () => {
    expect(FITNESS_DAILY_TEMPLATE).toBe(
      "gym_sos_fitness_daily"
    )
  })

  it("ships 30 rotating tips", () => {
    expect(DAILY_FITNESS_TIP_COUNT).toBe(30)
  })

  it("builds one key per member per local day", () => {
    const key = fitnessDailyIdempotencyKey(
      "member-1",
      "2026-10-10T00:00:00.000Z"
    )
    expect(key).toBe(
      "fitness-daily:member-1:2026-10-10"
    )
  })

  it("separates days and members", () => {
    const today = fitnessDailyIdempotencyKey(
      "member-1",
      "2026-10-10T00:00:00.000Z"
    )
    const tomorrow = fitnessDailyIdempotencyKey(
      "member-1",
      "2026-10-11T00:00:00.000Z"
    )
    const other = fitnessDailyIdempotencyKey(
      "member-2",
      "2026-10-10T00:00:00.000Z"
    )
    expect(today).not.toBe(tomorrow)
    expect(today).not.toBe(other)
  })
})
