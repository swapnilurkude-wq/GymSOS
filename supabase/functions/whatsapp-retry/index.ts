import { createClient } from "jsr:@supabase/supabase-js@2"

import { dispatchMessage } from "../_shared/whatsapp/dispatch.ts"

/**
 * Super Admin manual retry of a FAILED message.
 *
 *   POST /whatsapp-retry   { message_id }
 *
 * The retry re-queues the SAME outbox row (same
 * idempotency key and content — a retry can never
 * create a duplicate message), then dispatches it
 * immediately with a full eligibility re-check.
 *
 * Only 'failed' rows qualify. Suppressed rows stay
 * suppressed with their recorded reason; cancelled
 * rows stay cancelled.
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

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
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
    return json({ error: "Only the Super Admin can retry messages." }, 403)
  }

  if (!encryptionKey) {
    return json(
      { error: "Server is missing the WHATSAPP_ENCRYPTION_KEY secret." },
      500
    )
  }

  let body: { message_id?: string } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400)
  }

  const messageId = body.message_id ?? ""
  if (!isValidUuid(messageId)) {
    return json({ error: "A valid message id is required." }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // Re-queue the failed row (same row — no
  // duplicate). Returns false unless the row is
  // currently 'failed'.
  const { data: requeued, error: retryError } = await admin.rpc(
    "retry_message",
    {
      p_message_id: messageId,
      p_retried_by: callerData.user.id,
    }
  )

  if (retryError) {
    return json({ error: retryError.message }, 500)
  }
  if (!requeued) {
    return json(
      {
        error:
          "Only failed messages can be retried. Suppressed and cancelled messages stay as they are.",
      },
      400
    )
  }

  // Dispatch immediately with a full eligibility
  // re-check (the claim happens inside dispatch).
  const result = await dispatchMessage(admin, messageId, {
    encryptionKey,
  })

  return json({
    messageId,
    outcome: result.outcome,
    reason: result.reason,
    providerMessageId: result.providerMessageId,
  })
})
