import { createClient } from "jsr:@supabase/supabase-js@2"

import { dispatchMessage } from "../_shared/whatsapp/dispatch.ts"

/**
 * Message scheduler — invoked by a cron job
 * (Supabase dashboard → Functions →
 * whatsapp-scheduler → Configure → Schedule,
 * suggested: every 15 minutes) or manually.
 *
 * Each run:
 *   1. enqueues due owner subscription
 *      reminders (7/3/0 days — migration
 *      0009; idempotent on the
 *      idempotency key)
 *   2. cancels stale rows (pending > 7 days)
 *   3. claims due messages one at a time
 *      (atomic, skip-locked — overlapping
 *      runs can never double-dispatch)
 *   4. re-checks eligibility immediately
 *      before every delivery
 *   5. sends and logs the outcome
 *
 * Safety:
 *   * ?dry_run=true evaluates everything and
 *     reports what WOULD be sent — no database
 *     writes, no provider calls
 *   * the daily send cap and business hours
 *     are enforced per message at send time
 *   * a message is only ever dispatched if it
 *     is claimable, so repeated invocation is
 *     idempotent
 *
 * Supabase's internal cron invokes the function
 * directly (no headers), so access is not
 * secret-gated: the function is safe to invoke
 * because it only dispatches legitimately due,
 * already-enqueued messages, atomically, within
 * the platform's daily cap.
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

const BATCH_CAP = 25

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const encryptionKey = Deno.env.get("WHATSAPP_ENCRYPTION_KEY")

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server is not configured correctly." }, 500)
  }
  if (!encryptionKey) {
    return json(
      { error: "Server is missing the WHATSAPP_ENCRYPTION_KEY secret." },
      500
    )
  }

  const dryRun = new URL(req.url).searchParams.get("dry_run") === "true"

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // Enqueue the owner subscription-expiry
  // reminders that are due (idempotent —
  // repeated runs never duplicate a
  // reminder). Best effort: a failure
  // here must not stop the run.
  let enqueued = 0
  if (!dryRun) {
    try {
      const { data: enqueuedCount } = await admin.rpc(
        "enqueue_owner_subscription_reminders"
      )
      enqueued = Number(enqueuedCount ?? 0)
    } catch (error) {
      console.error(
        "enqueue_owner_subscription_reminders failed",
        error
      )
    }

    // Release rows that have been pending
    // too long (best effort — a failure
    // here must not stop the run).
    try {
      await admin.rpc("cancel_stale_messages")
    } catch (error) {
      console.error("cancel_stale_messages failed", error)
    }
  }

  const results: Array<{
    messageId: string
    outcome: string
    reason: string
    providerMessageId?: string
  }> = []

  for (let i = 0; i < BATCH_CAP; i++) {
    // Atomically claim the next due message.
    const { data: messageId, error: claimError } = await admin.rpc(
      "claim_due_message"
    )

    if (claimError) {
      return json({ error: claimError.message }, 500)
    }
    if (!messageId) {
      break // queue drained
    }

    const result = await dispatchMessage(
      admin,
      messageId as string,
      {
        dryRun,
        preClaimed: true,
        encryptionKey,
      }
    )

    results.push({
      messageId: messageId as string,
      outcome: result.outcome,
      reason: result.reason,
      providerMessageId: result.providerMessageId,
    })
  }

  return json({
    dryRun,
    enqueued,
    dispatched: results.length,
    results,
  })
})
