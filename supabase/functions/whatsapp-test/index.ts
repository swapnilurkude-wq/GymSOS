import { createClient } from "jsr:@supabase/supabase-js@2"

import { decryptSecret } from "../_shared/whatsapp/crypto.ts"
import { createProvider } from "../_shared/whatsapp/providers.ts"

/**
 * Super Admin "Send test message" — the explicit,
 * authorized send that gates activation.
 *
 * Flow:
 *   1. Super Admin JWT verified (same gate as
 *      whatsapp-config)
 *   2. provider must be configured (is_configured)
 *   3. decrypt the access token in-memory only
 *   4. send the configured template to the
 *      configured TEST RECIPIENT ONLY
 *   5. record the outcome as a 'test' row in the
 *      outbox (audit trail) and stamp
 *      last_tested_at / tested_by on the config
 *
 * The template name comes from the request
 * (default "gym_sos_test") and must be an
 * APPROVED template in the Meta business account.
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

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: "Server is not configured correctly." }, 500)
  }

  // The caller must be a signed-in Super Admin.
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
    return json({ error: "Only the Super Admin can send test messages." }, 403)
  }

  if (!encryptionKey) {
    return json(
      { error: "Server is missing the WHATSAPP_ENCRYPTION_KEY secret." },
      500
    )
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // Load the provider config.
  const { data: config, error: configError } = await admin
    .from("whatsapp_provider_config")
    .select("*")
    .limit(1)
    .maybeSingle()

  if (configError) return json({ error: configError.message }, 500)
  if (!config || !config.is_configured) {
    return json(
      { error: "The WhatsApp provider is not configured yet." },
      400
    )
  }

  let accessToken: string
  try {
    accessToken = await decryptSecret(
      config.encrypted_access_token,
      encryptionKey
    )
  } catch {
    return json(
      { error: "The stored access token could not be decrypted." },
      500
    )
  }

  // Send — to the configured test recipient ONLY.
  let body: { template_name?: string; params?: Record<string, string> } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    // An empty body is fine — defaults are used.
  }

  const templateName = String(body.template_name ?? "gym_sos_test").trim()
  const templateParams = body.params ?? {}

  const provider = createProvider(config, accessToken)
  const result = await provider.send({
    to: config.test_recipient_phone,
    templateName,
    templateParams,
  })

  // Record the outcome (audit trail — best effort:
  // the message has already been sent at this
  // point, so an audit failure is reported as a
  // warning rather than overriding the result).
  let auditWarning: string | null = null
  const now = new Date().toISOString()
  const outboxRow = {
    id: crypto.randomUUID(),
    idempotency_key: `test-${callerData.user.id}-${now}`,
    gym_id: null, // test rows are not gym-bound
    member_id: null,
    owner_user_id: callerData.user.id,
    recipient_phone: config.test_recipient_phone,
    category: "test",
    template_name: templateName,
    template_params: templateParams,
    status: result.ok ? "sent" : "failed",
    status_reason: result.ok ? "" : (result.error ?? "send failed"),
    scheduled_for: now,
    attempts: 1,
    last_attempt_at: now,
    provider_message_id: result.providerMessageId ?? "",
    estimated_cost: 0,
    sent_at: result.ok ? now : null,
  }

  try {
    await admin.from("message_outbox").insert(outboxRow)
    await admin.from("message_events").insert({
      id: crypto.randomUUID(),
      message_id: outboxRow.id,
      event_type: result.ok ? "sent" : "failed",
      detail: {
        category: "test",
        error: result.error ?? null,
        error_code: result.errorCode ?? null,
        dry_run: false,
      },
      created_at: now,
    })
    await admin
      .from("whatsapp_provider_config")
      .update({
        last_tested_at: now,
        tested_by: callerData.user.id,
        last_error: result.ok ? null : (result.error ?? "send failed"),
      })
  } catch (auditError) {
    auditWarning =
      auditError instanceof Error ? auditError.message : "Audit log write failed"
  }

  if (!result.ok) {
    return json(
      {
        ok: false,
        error: result.error ?? "The test message failed.",
        errorCode: result.errorCode ?? null,
        ...(auditWarning ? { warning: auditWarning } : {}),
      },
      502
    )
  }

  return json({
    ok: true,
    providerMessageId: result.providerMessageId,
    sentTo: config.test_recipient_phone,
    ...(auditWarning ? { warning: auditWarning } : {}),
  })
})
