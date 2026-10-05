import { createClient } from "jsr:@supabase/supabase-js@2"

/**
 * Creates (or updates) a gym-owner login account.
 *
 * Called by the super-admin gym form. Requires a signed-in
 * super-admin (verified from the caller's JWT) and runs with
 * the service role key, which must never reach the browser.
 *
 * Body: { gymId, gymName, ownerName, email, password? }
 * Returns: { userId, email, name, role, gymId, gymName }
 *
 * Deploy: supabase functions deploy invite-gym-owner
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

interface InviteRequest {
  gymId?: string
  gymName?: string
  ownerName?: string
  email?: string
  password?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405)

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server is not configured." }, 500)
  }

  // 1. Verify the caller and require the super-admin role.
  const token = req.headers.get("Authorization")?.replace("Bearer ", "")
  if (!token) return json({ error: "Missing Authorization header." }, 401)

  const caller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  const { data: callerData, error: callerError } = await caller.auth.getUser()
  if (callerError || !callerData.user) {
    return json({ error: "Unauthorized." }, 401)
  }

  const { data: profile } = await caller
    .from("profiles")
    .select("role")
    .eq("id", callerData.user.id)
    .maybeSingle()
  if (!profile || profile.role !== "super-admin") {
    return json({ error: "Only platform administrators can manage owner logins." }, 403)
  }

  // 2. Validate the payload.
  let body: InviteRequest
  try {
    body = (await req.json()) as InviteRequest
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400)
  }

  const { gymId, gymName, ownerName, email, password } = body
  if (!gymId || !gymName || !ownerName || !email) {
    return json({ error: "gymId, gymName, ownerName and email are required." }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // 3. If the gym already has an owner, update that account in place.
  const { data: existing } = await admin
    .from("profiles")
    .select("id, email")
    .eq("gym_id", gymId)
    .eq("role", "gym-owner")
    .maybeSingle()

  if (existing) {
    const emailChanged = existing.email?.toLowerCase() !== email.toLowerCase()
    if (emailChanged || password) {
      const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
        ...(emailChanged ? { email } : {}),
        ...(password ? { password } : {}),
      })
      if (updateError) return json({ error: updateError.message }, 400)
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({ name: ownerName, gym_name: gymName, email })
      .eq("id", existing.id)
    if (profileError) return json({ error: profileError.message }, 400)

    return json({ userId: existing.id, email, name: ownerName, role: "gym-owner", gymId, gymName })
  }

  // 4. Refuse an email that already belongs to another account.
  const { data: conflicting } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle()
  if (conflicting) {
    return json({ error: "That email already has a GymSOS account." }, 409)
  }

  // 5. Create the auth user. The handle_new_user trigger
  //    (migration 0002) provisions the profile row automatically.
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: password ?? crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: ownerName },
  })
  if (authError) return json({ error: authError.message }, 400)

  // 6. Link the new profile to the gym.
  const { error: linkError } = await admin
    .from("profiles")
    .update({ role: "gym-owner", gym_id: gymId, gym_name: gymName, name: ownerName })
    .eq("id", authData.user.id)
  if (linkError) return json({ error: linkError.message }, 400)

  return json({ userId: authData.user.id, email, name: ownerName, role: "gym-owner", gymId, gymName })
})
