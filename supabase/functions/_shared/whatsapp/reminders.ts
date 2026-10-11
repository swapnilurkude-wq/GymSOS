/**
 * Subscription / membership expiry
 * reminder schedule — the contract
 * between the SQL enqueuers
 * (enqueue_owner_subscription_reminders
 * and enqueue_membership_expiry_reminders,
 * migrations 0009 / 0010) and the rest
 * of the system.
 *
 * The offsets MUST stay in sync with the
 * SQL functions' `foreach` arrays.
 */

/** Both reminder tracks fire 7, 3 and
 *  0 days before the end date. */
export const OWNER_REMINDER_OFFSETS: readonly number[] = [
  7, 3, 0,
]
export const MEMBER_REMINDER_OFFSETS: readonly number[] = [
  7, 3, 0,
]

/** The approved Meta templates. Their
 *  bodies have three text parameters:
 *  (1) gym or member name, (2) the end
 *  date, (3) the days label. */
export const OWNER_EXPIRY_TEMPLATE =
  "gym_sos_subscription_expiry"
export const MEMBER_EXPIRY_TEMPLATE =
  "gym_sos_membership_expiry"

/** Human-readable days label for the
 *  template's third parameter. */
export function reminderDaysLabel(
  offsetDays: number
): string {
  return offsetDays === 0 ? "today" : `${offsetDays} days`
}

/**
 * Idempotency key for an owner reminder.
 * Embeds the end date so a renewed
 * subscription (new end date) produces
 * fresh keys — stale reminders for the
 * old date are cancelled by the
 * gyms-update trigger.
 *
 * Must match the SQL format:
 *   owner-reminder:<gymId>:<offset>:<YYYY-MM-DD>
 */
export function ownerReminderIdempotencyKey(
  gymId: string,
  offsetDays: number,
  subscriptionEndDate: string
): string {
  return `owner-reminder:${gymId}:${offsetDays}:${subscriptionEndDate.slice(0, 10)}`
}

/**
 * Idempotency key for a member reminder.
 * Embeds the membership end date so a
 * renewal produces fresh keys.
 *
 * Must match the SQL format:
 *   membership-reminder:<memberId>:<offset>:<YYYY-MM-DD>
 */
export function membershipReminderIdempotencyKey(
  memberId: string,
  offsetDays: number,
  membershipEndDate: string
): string {
  return `membership-reminder:${memberId}:${offsetDays}:${membershipEndDate.slice(0, 10)}`
}
