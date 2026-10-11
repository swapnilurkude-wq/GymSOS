/**
 * Owner subscription-expiry reminder
 * schedule — the contract between the
 * SQL enqueuer (enqueue_owner_subscription_
 * reminders, migration 0009) and the
 * rest of the system.
 *
 * The offsets MUST stay in sync with the
 * SQL function's `foreach` array.
 */

/** Reminders fire 7, 3 and 0 days before
 *  the subscription end date. */
export const OWNER_REMINDER_OFFSETS: readonly number[] = [
  7, 3, 0,
]

/** The approved Meta template that carries
 *  the reminder. Its body has three text
 *  parameters: (1) gym name, (2) the end
 *  date, (3) the days label. */
export const OWNER_EXPIRY_TEMPLATE =
  "gym_sos_subscription_expiry"

/** Human-readable days label for the
 *  template's third parameter. */
export function ownerReminderDaysLabel(
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
