import { createClient } from "jsr:@supabase/supabase-js@2"

import { decryptSecret } from "../_shared/whatsapp/crypto.ts"
import { createProvider } from "../_shared/whatsapp/providers.ts"
import {
  checkVerificationCode,
  generateVerificationCode,
  hashCode,
  isCodeRequestAllowed,
  normalizeWhatsAppNumber,
} from "../_shared/whatsapp/verification.ts"

/**
 * Gym Owner WhatsApp number verification.
 *
 *   POST /whatsapp-owner-verify
 *   { action: "send_code", whatsapp_number }
 *   { action: "verify", code }
 *
 * Flow:
 *   1. Gym-owner JWT verified (owners
 *      manage only their own settings)
 *   2. send_code — validate the number,
 *      rate-limit requests (one per
 *      minute), generate a 6-digit code,
 *      store ONLY its SHA-256 hash with a
 *      sent timestamp, and send the code
 *      through the configured provider
 *      using an approved template
 *   3. verify — compare the hash of the
 *      submitted code; codes expire after
 *      10 minutes and are invalidated
 *      after 5 wrong attempts
 *
 * The template must be an APPROVED
 * business template with one text
 * parameter (the code). Configure its
 * name with WHATSAPP_VERIFICATION_TEMPLATE
 * (default "gym_sos_verification").
 *
 * Verification sends are not recorded in
 * the message outbox — the categories
 * there cover member messaging, and the
 * verification state itself is the audit
 * trail (code sent at / verified at).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  })
}

const CODE_TTL_MS = 10 * 60 * 1000
const CODE_MAX_ATTEMPTS = 5
const REQUEST_COOLDOWN_MS = 60 * 1000

function isValidNumber(value: string): boolean {
  return /^[0-9]{10,15}$/.test(value)
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  const encryptionKey = Deno.env.get("WHATSAPP_ENCRYPTION_KEY")
  const templateName =
    Deno.env.get("WHATSAPP_VERIFICATION_TEMPLATE") ??
    "gym_sos_verification"

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: "Server is not configured correctly." }, 500)
  }

  // The caller must be a signed-in gym owner.
  const authHeader = req.headers.get("Authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim()
  if (!token) {
    return json({ error: "Missing Authorization header." }, 401)
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })

  const { data: callerData, error: callerError } =
    await caller.auth.getUser()
  if (callerError || !callerData.user) {
    return json({ error: "Unauthorized." }, 401)
  }

  const { data: profile, error: profileError } = await caller
    .from("profiles")
    .select("role")
    .eq("id", callerData.user.id)
    .maybeSingle()

  if (profileError) {
    return json({ error: profileError.message }, 500)
  }
  if (!profile || profile.role !== "gym-owner") {
    return json(
      { error: "Only gym owners can verify a WhatsApp number." },
      403
    )
  }

  const ownerId = callerData.user.id
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const { data: existing, error: readError } = await admin
    .from("gym_owner_whatsapp")
    .select("*")
    .eq("user_id", ownerId)
    .maybeSingle()

  if (readError) {
    return json({ error: readError.message }, 500)
  }

  let body: { action?: string; whatsapp_number?: string; code?: string } =
    {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400)
  }

  // ── send_code ─────────────────────────────────────────
  if (body.action === "send_code") {
    const rawNumber = String(body.whatsapp_number ?? "").trim()
    const number = normalizeWhatsAppNumber(rawNumber)
    if (!isValidNumber(number)) {
      return json(
        {
          error:
            "Enter a valid WhatsApp number (10–15 digits, country code included).",
        },
        400
      )
    }

    if (
      !isCodeRequestAllowed(existing?.verification_code_sent_at ?? null, {
        cooldownMs: REQUEST_COOLDOWN_MS,
      })
    ) {
      return json(
        { error: "Please wait a minute before requesting another code." },
        429
      )
    }

    // The provider must be configured and active —
    // otherwise no code can be delivered at all.
    const { data: providerConfig } = await admin
      .from("whatsapp_provider_config")
      .select("*")
      .maybeSingle()

    if (!providerConfig || !providerConfig.is_configured) {
      return json(
        {
          error:
            "WhatsApp messaging is not configured by the Super Admin yet.",
        },
        409
      )
    }
    if (!providerConfig.is_active) {
      return json(
        { error: "WhatsApp messaging is currently deactivated." },
        409
      )
    }

    const code = generateVerificationCode()
    const hash = await hashCode(code)
    const now = new Date().toISOString()

    // Persist the number (unverified) and the code
    // hash. Only the hash is stored — never the code.
    const { error: upsertError } = await admin
      .from("gym_owner_whatsapp")
      .upsert({
        user_id: ownerId,
        whatsapp_number: number,
        is_verified: false,
        verification_code_hash: hash,
        verification_code_sent_at: now,
        verification_code_attempts: 0,
      })

    if (upsertError) {
      return json({ error: upsertError.message }, 500)
    }

    // Deliver the code through the provider.
    let accessToken: string
    try {
      accessToken = await decryptSecret(
        providerConfig.encrypted_access_token ?? "",
        encryptionKey ?? ""
      )
    } catch {
      return json(
        { error: "Provider credentials could not be decrypted." },
        500
      )
    }

    const provider = createProvider(providerConfig, accessToken)
    const sendResult = await provider.send({
      to: number,
      templateName,
      templateParams: { "1": code },
    })

    if (!sendResult.ok) {
      // The code was never delivered — clear the
      // hash so it cannot be replayed.
      await admin
        .from("gym_owner_whatsapp")
        .update({
          verification_code_hash: null,
          verification_code_sent_at: null,
          verification_code_attempts: 0,
        })
        .eq("user_id", ownerId)

      return json(
        {
          error: `The verification message could not be sent: ${
            sendResult.error ?? "provider error"
          }`,
        },
        502
      )
    }

    return json({ sent: true, whatsappNumber: number })
  }

  // ── verify ────────────────────────────────────────────
  if (body.action === "verify") {
    const code = String(body.code ?? "").trim()
    if (!/^[0-9]{6}$/.test(code)) {
      return json(
        { error: "Enter the 6-digit code you received." },
        400
      )
    }

    const decision = await checkVerificationCode(
      {
        hash: existing?.verification_code_hash ?? null,
        sentAt: existing?.verification_code_sent_at ?? null,
        attempts: Number(existing?.verification_code_attempts ?? 0),
      },
      code,
      { ttlMs: CODE_TTL_MS, maxAttempts: CODE_MAX_ATTEMPTS }
    )

    if (decision.ok) {
      const { error: updateError } = await admin
        .from("gym_owner_whatsapp")
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
          verification_code_hash: null,
          verification_code_sent_at: null,
          verification_code_attempts: 0,
        })
        .eq("user_id", ownerId)

      if (updateError) {
        return json({ error: updateError.message }, 500)
      }

      return json({
        verified: true,
        whatsappNumber: existing?.whatsapp_number ?? "",
      })
    }

    if (decision.reason === "no_code") {
      return json(
        { error: "No verification code has been requested yet." },
        400
      )
    }

    if (decision.reason === "expired") {
      return json(
        { error: "The code expired. Request a new one." },
        400
      )
    }

    if (decision.reason === "exhausted") {
      // Invalidate the used-up code so a fresh
      // request is required.
      await admin
        .from("gym_owner_whatsapp")
        .update({
          verification_code_hash: null,
          verification_code_sent_at: null,
          verification_code_attempts: 0,
        })
        .eq("user_id", ownerId)

      return json(
        {
          error:
            "Too many failed attempts. Request a new code.",
        },
        429
      )
    }

    // Mismatch — record the attempt (the shared
    // checker treats the limit as exhausted only
    // once attempts reach the maximum).
    const nextAttempts =
      Number(existing?.verification_code_attempts ?? 0) + 1
    await admin
      .from("gym_owner_whatsapp")
      .update({ verification_code_attempts: nextAttempts })
      .eq("user_id", ownerId)

    const remaining = CODE_MAX_ATTEMPTS - nextAttempts
    return json(
      {
        error: `Invalid code. ${remaining} ${
          remaining === 1 ? "attempt" : "attempts"
        } remaining.`,
      },
      400
    )
  }

  return json(
    { error: 'Unknown action. Use "send_code" or "verify".' },
    400
  )
})
