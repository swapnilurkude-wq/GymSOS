/**
 * Row shapes for the WhatsApp messaging tables
 * (migration 0005). The Edge Functions read these
 * rows with the service role client; the eligibility
 * engine consumes them as an immutable snapshot.
 */

export type WhatsAppProviderName =
  | "meta-cloud-api"
  | "gupshup"
  | "twilio"
  | "three60dialog"

export interface ProviderConfigRow {
  provider: WhatsAppProviderName
  phone_number_id: string
  business_account_id: string
  /** Base64 "iv:ciphertext" — never decrypt in the browser. */
  encrypted_access_token: string | null
  encrypted_webhook_secret: string | null
  test_recipient_phone: string
  is_configured: boolean
  is_active: boolean
  last_error: string | null
  last_tested_at: string | null
  tested_by: string | null
}

export interface MessagingControlsRow {
  global_paused: boolean
  daily_send_cap: number
  /** "HH:MM:SS" — platform business-hours window. */
  business_hours_start: string
  business_hours_end: string
  timezone: string
}

export interface GymRow {
  id: string
  status: "active" | "suspended" | "expired"
  subscription_end_date: string
}

export interface GymMessagingSettingsRow {
  membership_expiry_reminders: boolean
  daily_fitness_messages: boolean
  paused: boolean
}

export interface OwnerProfileRow {
  role: "super-admin" | "gym-owner"
}

export interface OwnerWhatsappRow {
  whatsapp_number: string
  is_verified: boolean
  fitness_daily: boolean
  membership_expiry: boolean
  service_reminders: boolean
}

export interface MemberOptinRow {
  whatsapp_number: string
  opted_in: boolean
  fitness_daily: boolean
  membership_expiry: boolean
  opted_out_at: string | null
}

export type OutboxCategory =
  | "fitness_daily"
  | "membership_expiry"
  | "owner_subscription_expiry"
  | "test"

export type OutboxStatus =
  | "scheduled"
  | "pending"
  | "sending"
  | "sent"
  | "delivered"
  | "failed"
  | "suppressed"
  | "cancelled"

export interface OutboxMessageRow {
  id: string
  gym_id: string
  member_id: string | null
  owner_user_id: string | null
  recipient_phone: string
  category: OutboxCategory
  template_name: string
  template_params: Record<string, string>
  status: OutboxStatus
  status_reason: string
  scheduled_for: string
  attempts: number
}
