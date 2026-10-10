/**
 * Message dispatch — the shared send path used by
 * the scheduler (cron) and the Super Admin manual
 * retry.
 *
 * Every dispatch:
 *   1. claims the row atomically (unless the
 *      caller already claimed it via
 *      claim_due_message())
 *   2. loads an eligibility snapshot from the
 *      database
 *   3. runs the eligibility engine
 *      IMMEDIATELY BEFORE DELIVERY — not at
 *      scheduling time — so an expired gym,
 *      an opt-out or a renewal that happened
 *      while the message was queued still
 *      suppresses it
 *   4. sends through the provider (unless
 *      dryRun) and records the outcome
 *
 * Outcome handling:
 *   eligible          → sent / failed (provider result)
 *   deferrable        → released back to 'pending'
 *                       (business hours, daily cap,
 *                       provider paused) — retried
 *                       on the next scheduler run
 *   terminal          → 'suppressed' with the reason
 *   unexpected error  → 'failed' (a row never
 *                       sticks in 'sending')
 *
 * dryRun performs the full eligibility evaluation
 * but touches nothing in the database and never
 * calls the provider — the safe way to rehearse
 * a send.
 */

import { decryptSecret } from "./crypto.ts"
import { checkMessageEligibility } from "./eligibility.ts"
import type { EligibilitySnapshot } from "./eligibility.ts"
import { createProvider } from "./providers.ts"
import type {
  GymMessagingSettingsRow,
  GymRow,
  MessagingControlsRow,
  MemberOptinRow,
  OwnerProfileRow,
  OwnerWhatsappRow,
  OutboxMessageRow,
  ProviderConfigRow,
} from "./types.ts"

/**
 * The minimal slice of the Supabase client the
 * dispatch path uses. The service-role client
 * satisfies it structurally; tests inject a stub.
 */
export interface QueryChain {
  eq(column: string, value: unknown): QueryChain
  maybeSingle(): Promise<DbResult>
}

export interface DbClient {
  from(table: string): {
    select(columns?: string): QueryChain
    update(
      values: Record<string, unknown>
    ): {
      eq(column: string, value: unknown): Promise<DbResult>
    }
    insert(
      values: Record<string, unknown>
    ): Promise<DbResult>
  }
  rpc(
    name: string,
    params: Record<string, unknown>
  ): Promise<DbResult>
}

export interface DbResult {
  data: unknown
  error: { message: string } | null
}

export interface DispatchOptions {
  /** Simulate without touching the database or the provider. */
  dryRun?: boolean
  /** The caller already claimed the row (scheduler path). */
  preClaimed?: boolean
  /** WHATSAPP_ENCRYPTION_KEY — required to decrypt the provider token. */
  encryptionKey: string
  /** Injectable clock (tests). */
  now?: Date
}

export type DispatchOutcome =
  | "sent"
  | "failed"
  | "deferred"
  | "suppressed"
  | "skipped"

export interface DispatchResult {
  outcome: DispatchOutcome
  reason: string
  providerMessageId?: string
  isDeferrable?: boolean
}

/** "HH:MM:SS" in the given IANA timezone. */
export function formatLocalTime(timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date())
}

async function maybeSingleRow<T>(
  client: DbClient,
  table: string,
  columns: string,
  filters: Array<{ column: string; value: unknown }> = []
): Promise<T | null> {
  let query = client.from(table).select(columns)
  for (const filter of filters) {
    query = query.eq(filter.column, filter.value)
  }
  const { data, error } = await query.maybeSingle()
  if (error) {
    throw new Error(`${table} read failed: ${error.message}`)
  }
  return (data as T | null) ?? null
}

/**
 * Loads the full eligibility snapshot for a queued
 * message. Only the rows the engine needs for the
 * message's path are fetched.
 */
export async function loadEligibilitySnapshot(
  client: DbClient,
  message: OutboxMessageRow,
  now: Date
): Promise<EligibilitySnapshot> {
  const provider = await maybeSingleRow<ProviderConfigRow>(
    client,
    "whatsapp_provider_config",
    "*"
  )
  const controls = await maybeSingleRow<MessagingControlsRow>(
    client,
    "platform_messaging_controls",
    "*"
  )
  const gym = await maybeSingleRow<GymRow>(
    client,
    "gyms",
    "id, status, subscription_end_date",
    [{ column: "id", value: message.gym_id }]
  )

  const timezone = controls?.timezone ?? "Asia/Kolkata"

  let sentTodayCount = 0
  if (controls) {
    const { data } = await client.rpc(
      "count_messages_sent_today",
      { p_timezone: timezone }
    )
    sentTodayCount = Number(data ?? 0)
  }

  const snapshot: EligibilitySnapshot = {
    message,
    now: now.toISOString(),
    localTimeOfDay: formatLocalTime(timezone),
    sentTodayCount,
    provider,
    controls,
    gym,
    gymSettings: null,
    ownerProfile: null,
    ownerWhatsapp: null,
    memberGymId: null,
    memberEndDate: null,
    memberOptin: null,
  }

  // Owner-bound rows (owner subscription reminders,
  // test sends): the owner's profile and WhatsApp
  // settings decide eligibility.
  if (message.owner_user_id) {
    snapshot.ownerProfile = await maybeSingleRow<OwnerProfileRow>(
      client,
      "profiles",
      "role",
      [{ column: "id", value: message.owner_user_id }]
    )
    snapshot.ownerWhatsapp =
      await maybeSingleRow<OwnerWhatsappRow>(
        client,
        "gym_owner_whatsapp",
        "*",
        [{ column: "user_id", value: message.owner_user_id }]
      )
  }

  // Member-bound rows: the gym's messaging toggles,
  // the member's gym link + membership dates and
  // the member's opt-in decide eligibility.
  if (message.member_id) {
    snapshot.gymSettings =
      await maybeSingleRow<GymMessagingSettingsRow>(
        client,
        "gym_messaging_settings",
        "*",
        [{ column: "gym_id", value: message.gym_id }]
      )

    interface MemberRow {
      gym_id: string
      end_date: string
    }
    const member = await maybeSingleRow<MemberRow>(
      client,
      "members",
      "gym_id, end_date",
      [{ column: "id", value: message.member_id }]
    )
    snapshot.memberGymId = member?.gym_id ?? null
    snapshot.memberEndDate = member?.end_date ?? null

    snapshot.memberOptin = await maybeSingleRow<MemberOptinRow>(
      client,
      "member_whatsapp_optins",
      "*",
      [{ column: "member_id", value: message.member_id }]
    )
  }

  return snapshot
}

/**
 * Dispatches one queued message. See the module
 * header for the outcome rules.
 */
export async function dispatchMessage(
  client: DbClient,
  messageId: string,
  options: DispatchOptions
): Promise<DispatchResult> {
  const now = options.now ?? new Date()

  // Dry run: evaluate eligibility against the
  // current state, report the decision, write
  // nothing, send nothing.
  if (options.dryRun) {
    const { data, error } = await client
      .from("message_outbox")
      .select("*")
      .eq("id", messageId)
      .maybeSingle()
    if (error || !data) {
      return { outcome: "suppressed", reason: "message_not_found" }
    }
    const message = data as OutboxMessageRow
    const snapshot = await loadEligibilitySnapshot(
      client,
      message,
      now
    )
    const decision = checkMessageEligibility(snapshot)
    return {
      outcome: decision.ok
        ? "sent"
        : decision.isDeferrable
          ? "deferred"
          : "suppressed",
      reason: decision.reason,
      isDeferrable: decision.isDeferrable,
    }
  }

  // Claim the row unless the scheduler already did.
  if (!options.preClaimed) {
    const { data: claimed } = await client.rpc(
      "claim_message_by_id",
      { p_message_id: messageId }
    )
    if (!claimed) {
      return {
        outcome: "skipped",
        reason: "already_claimed_or_not_claimable",
      }
    }
  }

  try {
    const { data, error } = await client
      .from("message_outbox")
      .select("*")
      .eq("id", messageId)
      .maybeSingle()
    if (error || !data) {
      return { outcome: "suppressed", reason: "message_not_found" }
    }
    const message = data as OutboxMessageRow

    // Only a claimed row may be dispatched; anything
    // else (already sent, suppressed, cancelled) is
    // left exactly as it is.
    if (message.status !== "sending") {
      return {
        outcome: "skipped",
        reason: `not_in_sending_state (${message.status})`,
      }
    }

    const snapshot = await loadEligibilitySnapshot(
      client,
      message,
      now
    )
    const decision = checkMessageEligibility(snapshot)

    if (!decision.ok) {
      if (decision.isDeferrable) {
        // Transient condition — release the claim and
        // try again on the next scheduler run.
        await client
          .from("message_outbox")
          .update({ status: "pending", updated_at: now.toISOString() })
          .eq("id", messageId)
        return {
          outcome: "deferred",
          reason: decision.reason,
          isDeferrable: true,
        }
      }

      // Terminal — suppress and record why.
      await client
        .from("message_outbox")
        .update({
          status: "suppressed",
          status_reason: decision.reason,
          updated_at: now.toISOString(),
        })
        .eq("id", messageId)
      await client.from("message_events").insert({
        message_id: messageId,
        event_type: "suppressed",
        detail: { reason: decision.reason, dry_run: false },
        created_at: now.toISOString(),
      })
      return { outcome: "suppressed", reason: decision.reason }
    }

    // Eligible — decrypt the token and send.
    if (!snapshot.provider?.encrypted_access_token) {
      await client
        .from("message_outbox")
        .update({
          status: "failed",
          status_reason: "access_token_missing",
          updated_at: now.toISOString(),
        })
        .eq("id", messageId)
      return { outcome: "failed", reason: "access_token_missing" }
    }

    let accessToken: string
    try {
      accessToken = await decryptSecret(
        snapshot.provider.encrypted_access_token,
        options.encryptionKey
      )
    } catch {
      await client
        .from("message_outbox")
        .update({
          status: "failed",
          status_reason: "access_token_decrypt_failed",
          updated_at: now.toISOString(),
        })
        .eq("id", messageId)
      return { outcome: "failed", reason: "access_token_decrypt_failed" }
    }

    const provider = createProvider(snapshot.provider, accessToken)
    const sendResult = await provider.send({
      to: message.recipient_phone,
      templateName: message.template_name,
      templateParams: message.template_params ?? {},
    })

    if (sendResult.ok) {
      await client
        .from("message_outbox")
        .update({
          status: "sent",
          status_reason: "",
          provider_message_id: sendResult.providerMessageId ?? "",
          sent_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", messageId)
      await client.from("message_events").insert({
        message_id: messageId,
        event_type: "sent",
        detail: {
          provider_message_id: sendResult.providerMessageId ?? null,
          dry_run: false,
        },
        created_at: now.toISOString(),
      })
      return {
        outcome: "sent",
        reason: "",
        providerMessageId: sendResult.providerMessageId,
      }
    }

    await client
      .from("message_outbox")
      .update({
        status: "failed",
        status_reason: sendResult.error ?? "send failed",
        updated_at: now.toISOString(),
      })
      .eq("id", messageId)
    await client.from("message_events").insert({
      message_id: messageId,
      event_type: "failed",
      detail: {
        error: sendResult.error ?? null,
        error_code: sendResult.errorCode ?? null,
        dry_run: false,
      },
      created_at: now.toISOString(),
    })
    return {
      outcome: "failed",
      reason: sendResult.error ?? "send failed",
    }
  } catch (unexpectedError) {
    // A row must never stick in 'sending' — mark it
    // failed so the retry budget (or a manual
    // retry) can pick it up.
    const reason =
      unexpectedError instanceof Error
        ? `dispatch_error: ${unexpectedError.message}`
        : "dispatch_error"
    try {
      await client
        .from("message_outbox")
        .update({
          status: "failed",
          status_reason: reason,
          updated_at: now.toISOString(),
        })
        .eq("id", messageId)
      await client.from("message_events").insert({
        message_id: messageId,
        event_type: "failed",
        detail: { error: reason, dry_run: false },
        created_at: now.toISOString(),
      })
    } catch {
      // Best effort — the scheduler logs the run.
    }
    return { outcome: "failed", reason }
  }
}
