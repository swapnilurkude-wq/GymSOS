import { describe, expect, it } from "vitest"

import {
  checkMessageEligibility,
  type EligibilitySnapshot,
} from "../../supabase/functions/_shared/whatsapp/eligibility"
import type { OutboxMessageRow } from "../../supabase/functions/_shared/whatsapp/types"

/**
 * The ten required scenarios from the WhatsApp plan,
 * plus the deferral rules, mapped onto the central
 * eligibility engine. `NOW` is fixed so windows are
 * deterministic.
 */

const NOW = "2026-10-10T12:00:00.000Z"
const AT = (iso: string) => new Date(iso).toISOString()

function baseMessage(
  overrides: Partial<OutboxMessageRow> = {}
): OutboxMessageRow {
  return {
    id: "msg-1",
    gym_id: "gym-1",
    member_id: "member-1",
    owner_user_id: null,
    recipient_phone: "919820000000",
    category: "fitness_daily",
    template_name: "gym_sos_daily_tip",
    template_params: {},
    status: "pending",
    status_reason: "",
    scheduled_for: NOW,
    attempts: 0,
    ...overrides,
  }
}

function baseSnapshot(
  overrides: Partial<EligibilitySnapshot> = {}
): EligibilitySnapshot {
  return {
    message: baseMessage(),
    now: NOW,
    localTimeOfDay: "12:00:00",
    sentTodayCount: 0,
    provider: {
      provider: "meta-cloud-api",
      phone_number_id: "12345",
      business_account_id: "",
      encrypted_access_token: null,
      encrypted_webhook_secret: null,
      test_recipient_phone: "919820000000",
      is_configured: true,
      is_active: true,
      last_error: null,
      last_tested_at: null,
      tested_by: null,
    },
    controls: {
      global_paused: false,
      daily_send_cap: 500,
      business_hours_start: "09:00:00",
      business_hours_end: "20:00:00",
      timezone: "Asia/Kolkata",
    },
    gym: {
      id: "gym-1",
      status: "active",
      subscription_end_date: AT("2026-11-10T00:00:00.000Z"),
    },
    gymSettings: {
      membership_expiry_reminders: true,
      daily_fitness_messages: true,
      paused: false,
    },
    ownerProfile: { role: "gym-owner" },
    ownerWhatsapp: {
      whatsapp_number: "919820000000",
      is_verified: true,
      fitness_daily: true,
      membership_expiry: true,
      service_reminders: true,
    },
    memberGymId: "gym-1",
    memberEndDate: AT("2026-10-13T00:00:00.000Z"),
    memberOptin: {
      whatsapp_number: "919820000000",
      opted_in: true,
      fitness_daily: true,
      membership_expiry: true,
      opted_out_at: null,
    },
    ...overrides,
  }
}

describe("WhatsApp eligibility — required scenarios", () => {
  it("1. active gym + opted-in member: fitness message is eligible", () => {
    const result = checkMessageEligibility(baseSnapshot())
    expect(result).toEqual({ ok: true, reason: "", isDeferrable: false })
  })

  it("2. expiring owner subscription: owner reminder reaches the owner", () => {
    const result = checkMessageEligibility(
      baseSnapshot({
        message: baseMessage({
          member_id: null,
          owner_user_id: "owner-1",
          category: "owner_subscription_expiry",
          template_name: "gym_sos_subscription_expiry",
        }),
        gym: {
          id: "gym-1",
          status: "active",
          subscription_end_date: AT("2026-10-13T00:00:00.000Z"), // 3 days
        },
      })
    )
    expect(result.ok).toBe(true)
  })

  it("3. expired owner subscription: owner reminders still send, member messages blocked", () => {
    const expiredGym = {
      id: "gym-1",
      status: "active" as const,
      subscription_end_date: AT("2026-10-09T00:00:00.000Z"), // yesterday
    }

    // The owner's own renewal reminder still goes out.
    const ownerResult = checkMessageEligibility(
      baseSnapshot({
        message: baseMessage({
          member_id: null,
          owner_user_id: "owner-1",
          category: "owner_subscription_expiry",
          template_name: "gym_sos_subscription_expiry",
        }),
        gym: expiredGym,
      })
    )
    expect(ownerResult.ok).toBe(true)

    // Every member message for that gym is blocked.
    const memberResult = checkMessageEligibility(
      baseSnapshot({ gym: expiredGym })
    )
    expect(memberResult).toEqual({
      ok: false,
      reason: "owner_subscription_inactive",
      isDeferrable: false,
    })
  })

  it("4. renewed subscription: pending owner reminders are suppressed at send time", () => {
    const result = checkMessageEligibility(
      baseSnapshot({
        message: baseMessage({
          member_id: null,
          owner_user_id: "owner-1",
          category: "owner_subscription_expiry",
          template_name: "gym_sos_subscription_expiry",
        }),
        gym: {
          id: "gym-1",
          status: "active",
          // Renewed far into the future — the trigger
          // already cancelled the queue; this is the
          // send-time backstop.
          subscription_end_date: AT("2027-10-10T00:00:00.000Z"),
        },
      })
    )
    expect(result).toEqual({
      ok: false,
      reason: "subscription_renewed_or_not_due",
      isDeferrable: false,
    })
  })

  it("5. owner subscription expires while a member message is queued: suppressed", () => {
    const result = checkMessageEligibility(
      baseSnapshot({
        gym: {
          id: "gym-1",
          status: "active",
          subscription_end_date: AT("2026-10-10T11:00:00.000Z"), // just passed
        },
      })
    )
    expect(result).toEqual({
      ok: false,
      reason: "owner_subscription_inactive",
      isDeferrable: false,
    })
  })

  it("6. member membership expires with the gym active: only that member's eligible reminders flow", () => {
    const gym = baseSnapshot().gym!

    // The expired member's reminder is stale — blocked.
    const expiredMember = checkMessageEligibility(
      baseSnapshot({
        message: baseMessage({
          category: "membership_expiry",
          template_name: "gym_sos_membership_expiry",
        }),
        memberEndDate: AT("2026-10-09T00:00:00.000Z"),
      })
    )
    expect(expiredMember).toEqual({
      ok: false,
      reason: "membership_already_expired",
      isDeferrable: false,
    })

    // A different member of the same gym, expiring in
    // 3 days, is still eligible.
    const expiringMember = checkMessageEligibility(
      baseSnapshot({
        message: baseMessage({
          member_id: "member-2",
          category: "membership_expiry",
          template_name: "gym_sos_membership_expiry",
        }),
        memberEndDate: AT("2026-10-13T00:00:00.000Z"),
      })
    )
    expect(expiringMember.ok).toBe(true)
    expect(gym.status).toBe("active")
  })

  it("7. member opts out: no further messages", () => {
    const unsubscribed = checkMessageEligibility(
      baseSnapshot({
        memberOptin: {
          whatsapp_number: "919820000000",
          opted_in: false,
          fitness_daily: false,
          membership_expiry: false,
          opted_out_at: AT(NOW),
        },
      })
    )
    expect(unsubscribed).toEqual({
      ok: false,
      reason: "member_unsubscribed",
      isDeferrable: false,
    })

    const notOptedIn = checkMessageEligibility(
      baseSnapshot({
        memberOptin: {
          whatsapp_number: "919820000000",
          opted_in: false,
          fitness_daily: false,
          membership_expiry: false,
          opted_out_at: null,
        },
      })
    )
    expect(notOptedIn).toEqual({
      ok: false,
      reason: "member_not_opted_in",
      isDeferrable: false,
    })
  })

  it("8. duplicate jobs: an already-sent message is never re-sent", () => {
    for (const status of ["sent", "delivered", "cancelled", "suppressed"] as const) {
      const result = checkMessageEligibility(
        baseSnapshot({ message: baseMessage({ status }) })
      )
      expect(result.ok).toBe(false)
      expect(result.isDeferrable).toBe(false)
    }

    const sent = checkMessageEligibility(
      baseSnapshot({ message: baseMessage({ status: "sent" }) })
    )
    expect(sent.reason).toBe("already_sent")
  })

  it("9. a failed message stays retryable while it is still eligible", () => {
    const result = checkMessageEligibility(
      baseSnapshot({ message: baseMessage({ status: "failed", attempts: 1 }) })
    )
    expect(result.ok).toBe(true)
  })

  it("10. deferred conditions wait instead of suppressing", () => {
    const outsideHours = checkMessageEligibility(
      baseSnapshot({ localTimeOfDay: "07:30:00" })
    )
    expect(outsideHours).toEqual({
      ok: false,
      reason: "outside_business_hours",
      isDeferrable: true,
    })

    const atCap = checkMessageEligibility(baseSnapshot({ sentTodayCount: 500 }))
    expect(atCap).toEqual({
      ok: false,
      reason: "daily_send_cap_reached",
      isDeferrable: true,
    })

    const paused = checkMessageEligibility(
      baseSnapshot({ controls: { ...baseSnapshot().controls!, global_paused: true } })
    )
    expect(paused).toEqual({
      ok: false,
      reason: "messaging_paused_globally",
      isDeferrable: true,
    })

    const providerOff = checkMessageEligibility(
      baseSnapshot({
        provider: { ...baseSnapshot().provider!, is_active: false },
      })
    )
    expect(providerOff).toEqual({
      ok: false,
      reason: "provider_not_active",
      isDeferrable: true,
    })
  })
})

describe("WhatsApp eligibility — strict member-path guards", () => {
  it("blocks a message whose member belongs to another gym", () => {
    const result = checkMessageEligibility(baseSnapshot({ memberGymId: "gym-2" }))
    expect(result).toEqual({
      ok: false,
      reason: "member_not_in_gym",
      isDeferrable: false,
    })
  })

  it("blocks member messages for a suspended gym", () => {
    const result = checkMessageEligibility(
      baseSnapshot({
        gym: {
          id: "gym-1",
          status: "suspended",
          subscription_end_date: AT("2026-11-10T00:00:00.000Z"),
        },
      })
    )
    expect(result.reason).toBe("gym_status_suspended")
  })

  it("blocks when the owner disabled the message category", () => {
    const result = checkMessageEligibility(
      baseSnapshot({
        gymSettings: {
          membership_expiry_reminders: false,
          daily_fitness_messages: false,
          paused: false,
        },
      })
    )
    expect(result).toEqual({
      ok: false,
      reason: "fitness_messages_disabled_by_owner",
      isDeferrable: false,
    })
  })

  it("blocks when the member disabled the category", () => {
    const result = checkMessageEligibility(
      baseSnapshot({
        memberOptin: {
          whatsapp_number: "919820000000",
          opted_in: true,
          fitness_daily: false,
          membership_expiry: true,
          opted_out_at: null,
        },
      })
    )
    expect(result).toEqual({
      ok: false,
      reason: "member_fitness_messages_disabled",
      isDeferrable: false,
    })
  })

  it("blocks when the recipient number does not match the member's opt-in number", () => {
    const result = checkMessageEligibility(
      baseSnapshot({
        message: baseMessage({ recipient_phone: "919999999999" }),
      })
    )
    expect(result).toEqual({
      ok: false,
      reason: "recipient_mismatch",
      isDeferrable: false,
    })
  })

  it("blocks owner reminders whose recipient is not the owner's verified number", () => {
    const result = checkMessageEligibility(
      baseSnapshot({
        message: baseMessage({
          member_id: null,
          owner_user_id: "owner-1",
          category: "owner_subscription_expiry",
          template_name: "gym_sos_subscription_expiry",
          recipient_phone: "919999999999",
        }),
        gym: {
          id: "gym-1",
          status: "active",
          subscription_end_date: AT("2026-10-13T00:00:00.000Z"),
        },
      })
    )
    expect(result).toEqual({
      ok: false,
      reason: "recipient_mismatch",
      isDeferrable: false,
    })
  })

  it("never allows a member target on the owner path", () => {
    const result = checkMessageEligibility(
      baseSnapshot({
        message: baseMessage({
          owner_user_id: "owner-1",
          category: "owner_subscription_expiry",
          template_name: "gym_sos_subscription_expiry",
        }),
      })
    )
    expect(result).toEqual({
      ok: false,
      reason: "owner_message_has_member_target",
      isDeferrable: false,
    })
  })

  it("blocks owner reminders when the owner has not consented to service reminders", () => {
    const result = checkMessageEligibility(
      baseSnapshot({
        message: baseMessage({
          member_id: null,
          owner_user_id: "owner-1",
          category: "owner_subscription_expiry",
          template_name: "gym_sos_subscription_expiry",
        }),
        ownerWhatsapp: {
          ...baseSnapshot().ownerWhatsapp!,
          service_reminders: false,
        },
        gym: {
          id: "gym-1",
          status: "active",
          subscription_end_date: AT("2026-10-13T00:00:00.000Z"),
        },
      })
    )
    expect(result).toEqual({
      ok: false,
      reason: "owner_service_reminders_disabled",
      isDeferrable: false,
    })
  })

  it("blocks test messages sent to a number other than the configured test recipient", () => {
    const result = checkMessageEligibility(
      baseSnapshot({
        message: baseMessage({
          member_id: null,
          owner_user_id: "admin-1",
          category: "test",
          recipient_phone: "919999999999",
        }),
      })
    )
    expect(result).toEqual({
      ok: false,
      reason: "test_recipient_mismatch",
      isDeferrable: false,
    })
  })

  it("allows a test message to the configured test recipient", () => {
    const result = checkMessageEligibility(
      baseSnapshot({
        message: baseMessage({
          member_id: null,
          owner_user_id: "admin-1",
          category: "test",
        }),
      })
    )
    expect(result.ok).toBe(true)
  })
})
