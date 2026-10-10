import { getSupabase, isSupabaseConfigured, SUPABASE_URL } from "@/lib/supabase"

/**
 * Gym Owner WhatsApp — the owner's own
 * settings (number verification, category
 * consents, preferred time), their gym's
 * message history, and member opt-ins.
 *
 * Remote mode: the owner's row is read and
 * written through RLS (the "users manage
 * own whatsapp settings" policy); settings
 * saves go through the save_owner_whatsapp_settings
 * RPC, which re-verifies a changed number.
 * Verification codes are issued and checked
 * by the whatsapp-owner-verify Edge Function
 * (only the SHA-256 hash of a code is ever
 * stored). Message history reads
 * message_outbox, which RLS restricts to
 * the owner's own gym.
 *
 * Demo mode (development only): reads report
 * nothing configured; mutations are refused.
 */

export interface OwnerWhatsAppSettings {
  whatsappNumber: string
  isVerified: boolean
  verifiedAt: string | null
  fitnessDaily: boolean
  membershipExpiry: boolean
  serviceReminders: boolean
  preferredTime: string
  timezone: string
}

export interface OwnerWhatsAppSaveInput {
  whatsappNumber: string
  fitnessDaily: boolean
  membershipExpiry: boolean
  serviceReminders: boolean
  preferredTime: string
  timezone: string
}

export interface OwnerMessageLogEntry {
  id: string
  recipientPhone: string
  category: string
  templateName: string
  status: string
  statusReason: string
  scheduledFor: string
  sentAt: string | null
  createdAt: string
}

export interface MemberWhatsappOptinValues {
  whatsappNumber: string
  optedIn: boolean
  fitnessDaily: boolean
  membershipExpiry: boolean
  preferredTime: string
}

const EMPTY_SETTINGS: OwnerWhatsAppSettings = {
  whatsappNumber: "",
  isVerified: false,
  verifiedAt: null,
  fitnessDaily: false,
  membershipExpiry: false,
  serviceReminders: false,
  preferredTime: "09:00:00",
  timezone: "Asia/Kolkata",
}

interface OwnerWhatsappRow {
  whatsapp_number: string
  is_verified: boolean
  verified_at: string | null
  fitness_daily: boolean
  membership_expiry: boolean
  service_reminders: boolean
  preferred_time: string
  timezone: string
}

function mapSettings(row: OwnerWhatsappRow): OwnerWhatsAppSettings {
  return {
    whatsappNumber: row.whatsapp_number ?? "",
    isVerified: Boolean(row.is_verified),
    verifiedAt: row.verified_at ?? null,
    fitnessDaily: Boolean(row.fitness_daily),
    membershipExpiry: Boolean(row.membership_expiry),
    serviceReminders: Boolean(row.service_reminders),
    preferredTime: row.preferred_time ?? "09:00:00",
    timezone: row.timezone ?? "Asia/Kolkata",
  }
}

interface OutboxRow {
  id: string
  recipient_phone: string
  category: string
  template_name: string
  status: string
  status_reason: string
  scheduled_for: string
  sent_at: string | null
  created_at: string
}

/**
 * The signed-in gym owner's WhatsApp
 * settings (defaults when none saved yet).
 */
export async function getOwnerWhatsAppSettings(): Promise<OwnerWhatsAppSettings> {
  if (!isSupabaseConfigured()) return EMPTY_SETTINGS

  const client = getSupabase()

  const { data: sessionData, error: sessionError } =
    await client.auth.getSession()
  if (sessionError) throw new Error(sessionError.message)

  const userId = sessionData.session?.user.id
  if (!userId) throw new Error("You must be signed in.")

  const { data, error } = await client
    .from("gym_owner_whatsapp")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return EMPTY_SETTINGS
  return mapSettings(data as OwnerWhatsappRow)
}

/**
 * Saves the owner's settings. Changing the
 * WhatsApp number resets verification (the
 * RPC handles this server-side) — the new
 * number must be verified with a fresh code.
 */
export async function saveOwnerWhatsAppSettings(
  input: OwnerWhatsAppSaveInput
): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("WhatsApp settings are not available in demo mode.")
  }

  const { data: sessionData, error: sessionError } =
    await getSupabase().auth.getSession()
  if (sessionError) throw new Error(sessionError.message)
  if (!sessionData.session) throw new Error("You must be signed in.")

  const { error } = await getSupabase().rpc(
    "save_owner_whatsapp_settings",
    {
      p_whatsapp_number: input.whatsappNumber,
      p_fitness_daily: input.fitnessDaily,
      p_membership_expiry: input.membershipExpiry,
      p_service_reminders: input.serviceReminders,
      p_preferred_time: input.preferredTime,
      p_timezone: input.timezone,
    }
  )
  if (error) throw new Error(error.message)
}

async function callVerifyFunction(
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "WhatsApp verification is not available in demo mode."
    )
  }

  const { data } = await getSupabase().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("You must be signed in.")

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/whatsapp-owner-verify`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }
  )

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >
  if (!response.ok || typeof payload.error === "string") {
    throw new Error(
      typeof payload.error === "string" ? payload.error : "The request failed."
    )
  }
  return payload
}

/** Sends a 6-digit verification code to the
 *  given number (rate-limited to one per
 *  minute). */
export async function requestWhatsAppVerificationCode(
  whatsappNumber: string
): Promise<{ whatsappNumber: string }> {
  const payload = await callVerifyFunction({
    action: "send_code",
    whatsapp_number: whatsappNumber,
  })
  return {
    whatsappNumber: String(payload.whatsappNumber ?? whatsappNumber),
  }
}

/** Checks the code the owner received. On
 *  success the number is marked verified. */
export async function verifyWhatsAppCode(
  code: string
): Promise<{ whatsappNumber: string }> {
  const payload = await callVerifyFunction({
    action: "verify",
    code,
  })
  return {
    whatsappNumber: String(payload.whatsappNumber ?? ""),
  }
}

/** The owner's gym's recent messages (RLS
 *  restricts the rows to the caller's gym). */
export async function getOwnerMessageHistory(
  limit = 10
): Promise<OwnerMessageLogEntry[]> {
  if (!isSupabaseConfigured()) return []

  const { data, error } = await getSupabase()
    .from("message_outbox")
    .select(
      "id, recipient_phone, category, template_name, status, status_reason, scheduled_for, sent_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return ((data ?? []) as OutboxRow[]).map((row) => ({
    id: row.id,
    recipientPhone: row.recipient_phone,
    category: row.category,
    templateName: row.template_name,
    status: row.status,
    statusReason: row.status_reason ?? "",
    scheduledFor: row.scheduled_for,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  }))
}

/**
 * Saves a member's WhatsApp opt-in (the
 * gym owner records consent). Upserts the
 * member_whatsapp_optins row; an explicit
 * opt-out cancels the member's queued
 * messages (0005 trigger).
 */
export async function saveMemberWhatsAppOptin(
  memberId: string,
  gymId: string,
  values: MemberWhatsappOptinValues
): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Member WhatsApp opt-ins are not available in demo mode."
    )
  }

  const now = new Date().toISOString()
  const { error } = await getSupabase()
    .from("member_whatsapp_optins")
    .upsert({
      member_id: memberId,
      gym_id: gymId,
      whatsapp_number: values.whatsappNumber,
      opted_in: values.optedIn,
      fitness_daily: values.fitnessDaily,
      membership_expiry: values.membershipExpiry,
      preferred_time: values.preferredTime,
      timezone: "Asia/Kolkata",
      opted_out_at: values.optedIn ? null : now,
      updated_at: now,
    })

  if (error) throw new Error(error.message)
}

/** A member's current opt-in (null when
 *  the member has no opt-in row yet). */
export async function getMemberWhatsAppOptin(
  memberId: string
): Promise<MemberWhatsappOptinValues | null> {
  if (!isSupabaseConfigured()) return null

  const { data, error } = await getSupabase()
    .from("member_whatsapp_optins")
    .select(
      "whatsapp_number, opted_in, fitness_daily, membership_expiry, preferred_time"
    )
    .eq("member_id", memberId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as {
    whatsapp_number: string
    opted_in: boolean
    fitness_daily: boolean
    membership_expiry: boolean
    preferred_time: string
  }

  return {
    whatsappNumber: row.whatsapp_number ?? "",
    optedIn: Boolean(row.opted_in),
    fitnessDaily: Boolean(row.fitness_daily),
    membershipExpiry: Boolean(row.membership_expiry),
    preferredTime: row.preferred_time ?? "09:00:00",
  }
}

/** Digits only; a bare 10-digit Indian
 *  mobile gets the 91 country code. */
export function normalizeWhatsAppNumber(input: string): string {
  const digits = input.replace(/\D/g, "")
  return digits.length === 10 ? `91${digits}` : digits
}
