/**
 * WhatsApp number verification — the pure
 * code logic shared by the whatsapp-owner-verify
 * Edge Function (and its tests).
 *
 * The flow:
 *   1. send_code  — generate a 6-digit code,
 *      store only its SHA-256 hash with a
 *      sent timestamp, send the code through
 *      the provider using an approved template
 *   2. verify     — hash the submitted code and
 *      compare; codes expire (10 minutes) and
 *      are exhausted after too many wrong
 *      attempts (5)
 *
 * The code itself is never persisted.
 */

/** Six-digit numeric code, e.g. "482913". */
export function generateVerificationCode(): string {
  // crypto.getRandomValues (not Math.random) —
  // the code must not be guessable.
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  const value =
    ((bytes[0] << 24) |
      (bytes[1] << 16) |
      (bytes[2] << 8) |
      bytes[3]) >>>
    0
  return String(value % 1_000_000).padStart(6, "0")
}

/** SHA-256 hex digest of the code. */
export async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export interface VerificationCodeRecord {
  hash: string | null
  sentAt: string | null
  attempts: number
}

export type CodeCheckResult =
  | { ok: true }
  | { ok: false; reason: "no_code" | "expired" | "exhausted" | "mismatch" }

export interface CheckCodeOptions {
  /** Injectable clock (tests). */
  now?: Date
  /** How long a code stays valid. Default 10 minutes. */
  ttlMs?: number
  /** Wrong attempts before the code is invalidated. Default 5. */
  maxAttempts?: number
}

/**
 * Checks a submitted code against the stored
 * record. The submitted code is hashed
 * before comparison — the stored value is
 * only ever a hash. Pure apart from the
 * hashing; the caller persists any
 * attempt-count change.
 */
export async function checkVerificationCode(
  record: VerificationCodeRecord,
  code: string,
  options: CheckCodeOptions = {}
): Promise<CodeCheckResult> {
  const now = options.now ?? new Date()
  const ttlMs = options.ttlMs ?? 10 * 60 * 1000
  const maxAttempts = options.maxAttempts ?? 5

  if (!record.hash || !record.sentAt) {
    return { ok: false, reason: "no_code" }
  }

  if (now.getTime() - new Date(record.sentAt).getTime() > ttlMs) {
    return { ok: false, reason: "expired" }
  }

  if (record.attempts >= maxAttempts) {
    return { ok: false, reason: "exhausted" }
  }

  // Constant-time-ish comparison: both sides
  // are fixed-length hex strings.
  const expected = record.hash.toLowerCase()
  const actual = (await hashCode(code)).toLowerCase()
  return expected === actual
    ? { ok: true }
    : { ok: false, reason: "mismatch" }
}

/** A code may be requested at most once per
 *  cooldown window (brute-force protection
 *  on the send side). */
export function isCodeRequestAllowed(
  sentAt: string | null,
  options: { now?: Date; cooldownMs?: number } = {}
): boolean {
  if (!sentAt) return true
  const now = options.now ?? new Date()
  const cooldownMs = options.cooldownMs ?? 60 * 1000
  return now.getTime() - new Date(sentAt).getTime() >= cooldownMs
}

/** Normalizes a WhatsApp number: strips
 *  non-digits, adds the 91 country code when
 *  a bare 10-digit Indian mobile is given. */
export function normalizeWhatsAppNumber(
  input: string
): string {
  const digits = input.replace(/\D/g, "")
  if (digits.length === 10) {
    return `91${digits}`
  }
  return digits
}
