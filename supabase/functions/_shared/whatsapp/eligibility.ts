/**
 * Central message eligibility engine — the AUTHORITATIVE
 * implementation. The SQL function
 * message_eligibility_check() in migration 0005 mirrors
 * this logic for in-database auditing; keep the two in
 * sync (same reason codes, same order, same deferral
 * rules).
 *
 * Pure: no I/O, no clock access (the caller injects
 * `now`), fully unit-testable. Called by the scheduler
 * and the dispatch path immediately BEFORE delivery —
 * never only at scheduling time.
 *
 * Outcomes:
 *   ok = true                        → send
 *   ok = false, isDeferrable = true  → transient
 *     (business hours, daily cap, provider paused):
 *     leave the message pending, retry later
 *   ok = false, isDeferrable = false → terminal:
 *     suppress the message and record the reason
 */

import type {
  GymRow,
  GymMessagingSettingsRow,
  MemberOptinRow,
  MessagingControlsRow,
  OutboxMessageRow,
  OwnerProfileRow,
  OwnerWhatsappRow,
  ProviderConfigRow,
} from "./types.ts"

const DAY_MS = 24 * 60 * 60 * 1000

export interface EligibilitySnapshot {
  /** The queued message being checked. */
  message: OutboxMessageRow
  /** Send moment, ISO string (injected — never Date.now()). */
  now: string
  /** "HH:MM:SS" in the platform timezone, computed by the caller. */
  localTimeOfDay: string
  /** Messages already sent/delivered today (platform timezone). */
  sentTodayCount: number
  provider: ProviderConfigRow | null
  controls: MessagingControlsRow | null
  gym: GymRow | null
  gymSettings: GymMessagingSettingsRow | null
  ownerProfile: OwnerProfileRow | null
  ownerWhatsapp: OwnerWhatsappRow | null
  /** The member row's gym_id — null when the member is missing. */
  memberGymId: string | null
  /** The member's membership end date — null when missing. */
  memberEndDate: string | null
  memberOptin: MemberOptinRow | null
}

export interface EligibilityResult {
  ok: boolean
  reason: string
  isDeferrable: boolean
}

function defer(reason: string): EligibilityResult {
  return { ok: false, reason, isDeferrable: true }
}

function block(reason: string): EligibilityResult {
  return { ok: false, reason, isDeferrable: false }
}

function allowed(): EligibilityResult {
  return { ok: true, reason: "", isDeferrable: false }
}

/** Lexicographic compare is valid for zero-padded "HH:MM:SS". */
function withinBusinessHours(
  localTimeOfDay: string,
  start: string,
  end: string
): boolean {
  return localTimeOfDay >= start && localTimeOfDay <= end
}

export function checkMessageEligibility(
  snap: EligibilitySnapshot
): EligibilityResult {
  const { message: m, now } = snap
  const nowMs = Date.parse(now)

  // Never re-send a handled message (idempotency).
  if (m.status === "sent" || m.status === "delivered") {
    return block(`already_${m.status}`)
  }
  if (m.status === "cancelled") return block("message_cancelled")
  if (m.status === "suppressed") return block("previously_suppressed")

  // Provider must be configured and activated.
  if (!snap.provider || !snap.provider.is_configured) {
    return defer("provider_not_configured")
  }
  if (!snap.provider.is_active) return defer("provider_not_active")

  // Global controls.
  const controls = snap.controls
  if (controls?.global_paused) return defer("messaging_paused_globally")
  if (
    controls &&
    !withinBusinessHours(snap.localTimeOfDay, controls.business_hours_start, controls.business_hours_end)
  ) {
    return defer("outside_business_hours")
  }
  if (controls && snap.sentTodayCount >= controls.daily_send_cap) {
    return defer("daily_send_cap_reached")
  }

  // ── Test messages: only to the configured test recipient ──
  if (m.category === "test") {
    if (!snap.provider.test_recipient_phone) {
      return block("test_recipient_not_configured")
    }
    if (m.recipient_phone !== snap.provider.test_recipient_phone) {
      return block("test_recipient_mismatch")
    }
    if (!m.owner_user_id) return block("test_missing_tester")
    return allowed()
  }

  // ── OWNER PATH: the owner's own subscription-expiry
  //    reminders. Deliberately does NOT require an
  //    active subscription — expiry is the trigger. ──
  if (m.category === "owner_subscription_expiry") {
    if (m.member_id) return block("owner_message_has_member_target")
    if (!m.owner_user_id) return block("owner_reminder_missing_owner")
    if (!snap.ownerProfile || snap.ownerProfile.role !== "gym-owner") {
      return block("owner_profile_invalid")
    }
    if (!snap.ownerWhatsapp || !snap.ownerWhatsapp.is_verified) {
      return block("owner_number_unverified")
    }
    if (!snap.ownerWhatsapp.service_reminders) {
      return block("owner_service_reminders_disabled")
    }
    if (!snap.ownerWhatsapp.whatsapp_number) {
      return block("owner_number_missing")
    }
    if (m.recipient_phone !== snap.ownerWhatsapp.whatsapp_number) {
      return block("recipient_mismatch")
    }
    if (!snap.gym) return block("gym_not_found")

    // An expired subscription does NOT suppress the
    // owner's own reminders — renewing an expired
    // subscription is exactly what they nudge about.
    // A renewed subscription (end date pushed
    // beyond the window) suppresses stale reminders
    // at send time.
    const endMs = Date.parse(snap.gym.subscription_end_date)
    if (endMs > nowMs + 7 * DAY_MS) {
      return block("subscription_renewed_or_not_due")
    }
    return allowed()
  }

  // ── MEMBER PATH (strict) ──
  if (!m.member_id || m.owner_user_id) {
    return block("member_message_missing_member")
  }

  if (!snap.gym) return block("gym_not_found")
  if (snap.gym.status !== "active") {
    return block(`gym_status_${snap.gym.status}`)
  }
  // Full owner-subscription check: active AND not
  // past the end date. An expired owner subscription
  // suppresses every member message for that gym.
  if (Date.parse(snap.gym.subscription_end_date) <= nowMs) {
    return block("owner_subscription_inactive")
  }

  // The member must belong to this gym.
  if (snap.memberGymId !== m.gym_id) return block("member_not_in_gym")

  // Owner's per-gym messaging toggles.
  if (!snap.gymSettings) return block("gym_messaging_not_configured")
  if (snap.gymSettings.paused) return block("gym_messaging_paused")
  if (
    m.category === "membership_expiry" &&
    !snap.gymSettings.membership_expiry_reminders
  ) {
    return block("membership_reminders_disabled_by_owner")
  }
  if (
    m.category === "fitness_daily" &&
    !snap.gymSettings.daily_fitness_messages
  ) {
    return block("fitness_messages_disabled_by_owner")
  }

  // Member opt-in state. An explicit unsubscribe is
  // reported precisely; a never-opted-in member is
  // simply not opted in.
  const optin = snap.memberOptin
  if (optin?.opted_out_at) return block("member_unsubscribed")
  if (!optin || !optin.opted_in) return block("member_not_opted_in")
  if (!optin.whatsapp_number) return block("member_number_missing")
  if (m.recipient_phone !== optin.whatsapp_number) {
    return block("recipient_mismatch")
  }
  if (m.category === "membership_expiry" && !optin.membership_expiry) {
    return block("member_membership_reminders_disabled")
  }
  if (m.category === "fitness_daily" && !optin.fitness_daily) {
    return block("member_fitness_messages_disabled")
  }

  // Membership-expiry reminders only make sense for a
  // membership that is still valid but inside the window.
  if (m.category === "membership_expiry") {
    const endMs = snap.memberEndDate ? Date.parse(snap.memberEndDate) : NaN
    if (snap.memberEndDate === null || Number.isNaN(endMs) || endMs <= nowMs) {
      return block("membership_already_expired")
    }
    if (endMs > nowMs + 7 * DAY_MS) {
      return block("membership_renewed_or_not_due")
    }
  }

  return allowed()
}
