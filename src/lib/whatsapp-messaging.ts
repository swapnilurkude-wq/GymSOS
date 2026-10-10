import { getSupabase, isSupabaseConfigured, SUPABASE_URL } from "@/lib/supabase"

/**
 * Super Admin WhatsApp messaging — reads the
 * message queue, the platform controls and
 * the per-gym pause switches, and triggers
 * safe manual retries.
 *
 * Remote mode: the tables live in Postgres
 * (migration 0005); pause toggles go through
 * the 0007 RPCs (RLS decides who may call
 * them); retries go through the whatsapp-retry
 * Edge Function with the signed-in user's
 * token — the function verifies the Super
 * Admin role server-side and re-checks
 * eligibility before re-sending.
 *
 * Demo mode (development only): reads report
 * an empty queue; mutations are refused —
 * there is no provider to message through.
 */

export type WhatsAppMessageCategory =
  | "fitness_daily"
  | "membership_expiry"
  | "owner_subscription_expiry"
  | "test"

export type WhatsAppMessageStatus =
  | "scheduled"
  | "pending"
  | "sending"
  | "sent"
  | "delivered"
  | "failed"
  | "suppressed"
  | "cancelled"

export interface WhatsAppMessage {
  id: string
  gymId: string | null
  memberId: string | null
  ownerUserId: string | null
  recipientPhone: string
  category: WhatsAppMessageCategory
  templateName: string
  status: WhatsAppMessageStatus
  statusReason: string
  scheduledFor: string
  attempts: number
  providerMessageId: string
  estimatedCost: number
  createdAt: string
  sentAt: string | null
}

export interface MessagingStats {
  total: number
  sent: number
  delivered: number
  failed: number
  suppressed: number
  cancelled: number
  /** scheduled + pending + sending */
  pending: number
  estimatedCost: number
}

export interface MessagingControls {
  globalPaused: boolean
  dailySendCap: number
  businessHoursStart: string
  businessHoursEnd: string
  timezone: string
}

export interface GymMessagingState {
  gymId: string
  gymName: string
  gymStatus: string
  paused: boolean
}

export interface MessagingOverview {
  stats: MessagingStats
  log: WhatsAppMessage[]
  controls: MessagingControls
  gyms: GymMessagingState[]
}

export interface RetryResult {
  outcome: string
  reason: string
  providerMessageId?: string
}

/** Stats cover a rolling window — the queue
 *  itself is unbounded history. */
const STATS_WINDOW_DAYS = 30
const LOG_LIMIT = 200

const EMPTY_CONTROLS: MessagingControls = {
  globalPaused: false,
  dailySendCap: 500,
  businessHoursStart: "09:00:00",
  businessHoursEnd: "20:00:00",
  timezone: "Asia/Kolkata",
}

const EMPTY_STATS: MessagingStats = {
  total: 0,
  sent: 0,
  delivered: 0,
  failed: 0,
  suppressed: 0,
  cancelled: 0,
  pending: 0,
  estimatedCost: 0,
}

const EMPTY_OVERVIEW: MessagingOverview = {
  stats: EMPTY_STATS,
  log: [],
  controls: EMPTY_CONTROLS,
  gyms: [],
}

interface OutboxRow {
  id: string
  gym_id: string | null
  member_id: string | null
  owner_user_id: string | null
  recipient_phone: string
  category: WhatsAppMessageCategory
  template_name: string
  status: WhatsAppMessageStatus
  status_reason: string
  scheduled_for: string
  attempts: number
  provider_message_id: string
  estimated_cost: number
  created_at: string
  sent_at: string | null
}

function mapMessage(row: OutboxRow): WhatsAppMessage {
  return {
    id: row.id,
    gymId: row.gym_id,
    memberId: row.member_id,
    ownerUserId: row.owner_user_id,
    recipientPhone: row.recipient_phone,
    category: row.category,
    templateName: row.template_name,
    status: row.status,
    statusReason: row.status_reason ?? "",
    scheduledFor: row.scheduled_for,
    attempts: Number(row.attempts ?? 0),
    providerMessageId: row.provider_message_id ?? "",
    estimatedCost: Number(row.estimated_cost ?? 0),
    createdAt: row.created_at,
    sentAt: row.sent_at,
  }
}

function computeStats(rows: OutboxRow[]): MessagingStats {
  const cutoff = Date.now() - STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const stats: MessagingStats = { ...EMPTY_STATS }

  for (const row of rows) {
    if (new Date(row.created_at).getTime() < cutoff) continue
    stats.total += 1
    stats.estimatedCost += Number(row.estimated_cost ?? 0)
    switch (row.status) {
      case "sent":
        stats.sent += 1
        break
      case "delivered":
        stats.delivered += 1
        break
      case "failed":
        stats.failed += 1
        break
      case "suppressed":
        stats.suppressed += 1
        break
      case "cancelled":
        stats.cancelled += 1
        break
      default:
        // scheduled, pending, sending
        stats.pending += 1
    }
  }

  return stats
}

/**
 * Everything the messaging page shows: 30-day
 * stats, the recent message log, the platform
 * controls and the per-gym pause switches.
 */
export async function getMessagingOverview(): Promise<MessagingOverview> {
  if (!isSupabaseConfigured()) return EMPTY_OVERVIEW

  const client = getSupabase()

  const [outbox, controls, gyms, gymSettings] = await Promise.all([
    client.from("message_outbox").select("*"),
    client
      .from("platform_messaging_controls")
      .select("*")
      .maybeSingle(),
    client.from("gyms").select("id, name, status"),
    client.from("gym_messaging_settings").select("gym_id, paused"),
  ])

  if (outbox.error) throw new Error(outbox.error.message)
  if (controls.error) throw new Error(controls.error.message)
  if (gyms.error) throw new Error(gyms.error.message)
  if (gymSettings.error) throw new Error(gymSettings.error.message)

  const rows = (outbox.data ?? []) as OutboxRow[]

  const pausedByGym = new Map<string, boolean>(
    ((gymSettings.data ?? []) as Array<{
      gym_id: string
      paused: boolean
    }>).map((setting) => [setting.gym_id, Boolean(setting.paused)])
  )

  const gymsList: GymMessagingState[] = (
    (gyms.data ?? []) as Array<{
      id: string
      name: string
      status: string
    }>
  ).map((gym) => ({
    gymId: gym.id,
    gymName: gym.name,
    gymStatus: gym.status,
    paused: pausedByGym.get(gym.id) ?? false,
  }))

  const log = [...rows]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, LOG_LIMIT)
    .map(mapMessage)

  return {
    stats: computeStats(rows),
    log,
    controls: controls.data
      ? {
          globalPaused: Boolean(controls.data.global_paused),
          dailySendCap: Number(controls.data.daily_send_cap ?? 500),
          businessHoursStart: String(
            controls.data.business_hours_start ?? "09:00:00"
          ),
          businessHoursEnd: String(
            controls.data.business_hours_end ?? "20:00:00"
          ),
          timezone: String(controls.data.timezone ?? "Asia/Kolkata"),
        }
      : EMPTY_CONTROLS,
    gyms: gymsList,
  }
}

export async function setGlobalMessagingPaused(
  paused: boolean
): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Messaging controls are not available in demo mode.")
  }

  const { error } = await getSupabase().rpc("set_global_messaging_paused", {
    p_paused: paused,
  })
  if (error) throw new Error(error.message)
}

export async function setGymMessagingPaused(
  gymId: string,
  paused: boolean
): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Messaging controls are not available in demo mode.")
  }

  const { error } = await getSupabase().rpc("set_gym_messaging_paused", {
    p_gym_id: gymId,
    p_paused: paused,
  })
  if (error) throw new Error(error.message)
}

/**
 * Super Admin manual retry of a FAILED message.
 * The Edge Function re-queues the same outbox row
 * (same idempotency key — a retry can never
 * create a duplicate) and re-checks eligibility
 * before sending.
 */
export async function retryWhatsAppMessage(
  messageId: string
): Promise<RetryResult> {
  if (!isSupabaseConfigured()) {
    throw new Error("Message retries are not available in demo mode.")
  }

  const { data } = await getSupabase().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("You must be signed in.")

  const response = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-retry`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message_id: messageId }),
  })

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >
  if (!response.ok || typeof payload.error === "string") {
    throw new Error(
      typeof payload.error === "string" ? payload.error : "The retry failed."
    )
  }

  return {
    outcome: String(payload.outcome ?? ""),
    reason: String(payload.reason ?? ""),
    providerMessageId: payload.providerMessageId
      ? String(payload.providerMessageId)
      : undefined,
  }
}
