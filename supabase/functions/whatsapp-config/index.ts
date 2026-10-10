import { createClient } from "jsr:@supabase/supabase-js@2"

import { encryptSecret } from "../_shared/whatsapp/crypto.ts"

/**
 * Super Admin WhatsApp provider configuration.
 *
 *   GET  /whatsapp-config            → connection status
 *                                    (never returns secrets)
 *   POST /whatsapp-config            → body { action, ... }
 *        action "save"       { provider, phone_number_id,
 *                            business_account_id,
 *                            access_token, webhook_secret,
 *                            test_recipient_phone }
 *        action "activate"   → is_active = true
 *        action "deactivate" → is_active = false
 *        action "reset"      → delete the config row
 *
 * Security:
 *   * Requires a signed-in Super Admin (JWT verified
 *     against the profiles table — gym owners and
 *     anonymous callers are rejected).
 *   * The access token and webhook secret are
 *     encrypted with WHATSAPP_ENCRYPTION_KEY (an
 *     Edge Function secret) before storage and are
 *     never returned by any endpoint.
 *   * Activating requires a completed test send
 *     (config.last_tested_at is set) — the
 *     integration cannot send before it is tested.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

const PROVIDERS = [
  "meta-cloud-api",
  "gupshup",
  "twilio",
  "three60dialog",
] as const

const PHONE_PATTERN = /^[0-9]{8,15}$/

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  const encryptionKey = Deno.env.get("WHATSAPP_ENCRYPTION_KEY")

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: "Server is not configured correctly." }, 500)
  }

  // ── Caller must be a signed-in Super Admin ──────────

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
  if (!profile || profile.role !== "super-admin") {
    return json({ error: "Only the Super Admin can configure WhatsApp." }, 403)
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // ── GET: connection status (no secrets) ───────────

  if (req.method === "GET") {
    const { data, error } = await admin
      .from("whatsapp_provider_config")
      .select(
        "provider, phone_number_id, business_account_id, test_recipient_phone, is_configured, is_active, last_error, last_tested_at, tested_by"
      )
      .limit(1)
      .maybeSingle()

    if (error) return json({ error: error.message }, 500)

    return json({
      configured: Boolean(data?.is_configured),
      active: Boolean(data?.is_active),
      provider: data?.provider ?? null,
      phoneNumberId: data?.phone_number_id ?? "",
      businessAccountId: data?.business_account_id ?? "",
      testRecipientPhone: data?.test_recipient_phone ?? "",
      lastError: data?.last_error ?? null,
      lastTestedAt: data?.last_tested_at ?? null,
      // Explicit false (not omitted) so the UI can
      // tell "never tested" from "test failed".
      tested: Boolean(data?.last_tested_at),
    })
  }

  // ── POST: save / activate / deactivate / reset ────

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400)
  }

  const action = body.action

  if (action === "reset") {
    const { error } = await admin
      .from("whatsapp_provider_config")
      .delete()
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true, action: "reset" })
  }

  if (action === "activate" || action === "deactivate") {
    // Activation requires a successful test send first —
    // "do not send messages until the integration is
    // configured and tested".
    if (action === "activate") {
      const { data, error } = await admin
        .from("whatsapp_provider_config")
        .select("is_configured, last_tested_at")
        .limit(1)
        .maybeSingle()
      if (error) return json({ error: error.message }, 500)
      if (!data?.is_configured) {
        return json(
          { error: "Save the provider credentials first." },
          400
        )
      }
      if (!data.last_tested_at) {
        return json(
          {
            error:
              "Send a test message before activating the integration.",
          },
          400
        )
      }
    }

    const { error } = await admin
      .from("whatsapp_provider_config")
      .update({ is_active: action === "activate" })
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true, action, isActive: action === "activate" })
  }

  if (action === "save") {
    if (!encryptionKey) {
      return json(
        {
          error:
            "Server is missing the WHATSAPP_ENCRYPTION_KEY secret.",
        },
        500
      )
    }

    const provider = body.provider
    if (typeof provider !== "string" || !PROVIDERS.includes(provider as (typeof PROVIDERS)[number])) {
      return json({ error: "Choose a supported provider." }, 400)
    }

    const phoneNumberId = String(body.phone_number_id ?? "").trim()
    const accessToken = String(body.access_token ?? "").trim()
    if (!phoneNumberId) {
      return json({ error: "The WhatsApp phone number id is required." }, 400)
    }
    if (!accessToken) {
      return json({ error: "The access token is required." }, 400)
    }

    const testRecipientPhone = String(body.test_recipient_phone ?? "").trim()
    if (!PHONE_PATTERN.test(testRecipientPhone)) {
      return json(
        { error: "Enter the test recipient as an E.164 number (digits only, e.g. 919820000000)." },
        400
      )
    }

    const webhookSecret = String(body.webhook_secret ?? "").trim()

    // Encrypt secrets before they touch the database.
    const encryptedToken = await encryptSecret(accessToken, encryptionKey)
    const encryptedWebhookSecret = webhookSecret
      ? await encryptSecret(webhookSecret, encryptionKey)
      : null

    const row = {
      provider,
      phone_number_id: phoneNumberId,
      business_account_id: String(body.business_account_id ?? "").trim(),
      encrypted_access_token: encryptedToken,
      encrypted_webhook_secret: encryptedWebhookSecret,
      test_recipient_phone: testRecipientPhone,
      is_configured: true,
      // Saving new credentials invalidates the previous
      // activation until a fresh test send succeeds.
      is_active: false,
      last_error: null,
      last_tested_at: null,
      tested_by: null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await admin
      .from("whatsapp_provider_config")
      .upsert(row)
    if (error) return json({ error: error.message }, 500)

    return json({ ok: true, action: "save" })
  }

  return json({ error: "Unknown action. Use save, activate, deactivate or reset." }, 400)
})
