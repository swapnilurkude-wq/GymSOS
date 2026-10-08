import { createClient } from "jsr:@supabase/supabase-js@2"

/**
 * Public Gym Owner signup with a 10-day free trial.
 *
 * Flow (all server-side):
 *   1. validate the form fields
 *   2. reject duplicate email / mobile
 *   3. create the Supabase Auth user — the
 *      handle_new_user() trigger provisions a
 *      profile with role = 'gym-owner' (the role
 *      is assigned here, never by the client)
 *   4. create the gym on a 10-day trial via the
 *      create_trial_gym() RPC, which computes
 *      subscription_end_date from SQL now()
 *
 * The caller is anonymous (the deployed web app),
 * authenticated with the project's anon key —
 * Supabase verifies it as the "anon" role.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const MOBILE_PATTERN = /^[6-9]\d{9}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  })
}

interface SignupRequest {
  gymName?: string
  ownerName?: string
  mobile?: string
  email?: string
  password?: string
  confirmPassword?: string
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

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server is not configured correctly." }, 500)
  }

  let body: SignupRequest

  try {
    body = (await req.json()) as SignupRequest
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400)
  }

  const gymName = body.gymName?.trim() ?? ""
  const ownerName = body.ownerName?.trim() ?? ""
  const mobile = body.mobile?.trim() ?? ""
  const email = body.email?.trim().toLowerCase() ?? ""
  const password = body.password ?? ""
  const confirmPassword = body.confirmPassword ?? ""

  // ── Validation ──────────────────────────────────────────

  if (!gymName) {
    return json({ error: "Gym name is required." }, 400)
  }
  if (gymName.length > 100) {
    return json({ error: "Gym name must be 100 characters or fewer." }, 400)
  }
  if (!ownerName) {
    return json({ error: "Owner name is required." }, 400)
  }
  if (ownerName.length > 100) {
    return json({ error: "Owner name must be 100 characters or fewer." }, 400)
  }
  if (!mobile) {
    return json({ error: "Mobile number is required." }, 400)
  }
  if (!MOBILE_PATTERN.test(mobile)) {
    return json(
      {
        error:
          "Enter a valid 10-digit mobile number (Indian mobiles start with 6–9).",
      },
      400
    )
  }
  if (!email) {
    return json({ error: "Email address is required." }, 400)
  }
  if (!EMAIL_PATTERN.test(email)) {
    return json({ error: "Enter a valid email address." }, 400)
  }
  if (password.length < 6) {
    return json({ error: "Password must be at least 6 characters." }, 400)
  }
  if (password !== confirmPassword) {
    return json({ error: "Passwords don't match." }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
    },
  })

  // ── Duplicate checks ────────────────────────────────────

  const { data: emailTaken, error: emailError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle()

  if (emailError) {
    return json({ error: emailError.message }, 500)
  }
  if (emailTaken) {
    return json(
      { error: "This email is already registered. Please sign in instead." },
      409
    )
  }

  const { data: mobileTaken, error: mobileError } = await admin
    .from("gyms")
    .select("id")
    .eq("owner_contact", mobile)
    .maybeSingle()

  if (mobileError) {
    return json({ error: mobileError.message }, 500)
  }
  if (mobileTaken) {
    return json(
      {
        error:
          "This mobile number is already linked to a gym. Please sign in instead.",
      },
      409
    )
  }

  // ── Account creation ────────────────────────────────────

  // Create the Auth user. The on_auth_user_created trigger
  // auto-provisions a profile with role = 'gym-owner' —
  // a public signup can never become a super-admin.
  const { data: authData, error: authError } = await admin.auth.admin.createUser(
    {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: ownerName,
      },
    }
  )

  if (authError || !authData.user) {
    // auth.users enforces email uniqueness as a backstop.
    if (authError?.code === "23505" || authError?.message.includes("already")) {
      return json(
        { error: "This email is already registered. Please sign in instead." },
        409
      )
    }
    return json(
      { error: authError?.message ?? "Could not create the account." },
      400
    )
  }

  // Create the gym on a 10-day trial and link the owner's
  // profile to it. The trial end is computed in SQL from
  // the server clock by create_trial_gym().
  const { data: gymId, error: gymError } = await admin.rpc("create_trial_gym", {
    p_name: gymName,
    p_owner_name: ownerName,
    p_owner_email: email,
    p_owner_contact: mobile,
    p_owner_id: authData.user.id,
  })

  if (gymError || !gymId) {
    // Compensating action — never leave an account with
    // no gym behind.
    await admin.auth.admin.deleteUser(authData.user.id).catch(() => {})

    // Unique violation on gyms.owner_contact (race with a
    // concurrent signup).
    if (gymError?.code === "23505") {
      return json(
        {
          error:
            "This mobile number is already linked to a gym. Please sign in instead.",
        },
        409
      )
    }
    return json(
      { error: gymError?.message ?? "Could not create the gym." },
      400
    )
  }

  return json({
    gymId,
    gymName,
    ownerName,
    email,
  })
})
