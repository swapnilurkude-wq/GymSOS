import { createClient } from "jsr:@supabase/supabase-js@2"

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

interface InviteRequest {
  gymId?: string
  gymName?: string
  ownerName?: string
  email?: string
  password?: string
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
  const anonKey = 
  yesDeno.env.get("SUPABASE_ANON_KEY")

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json(
      { error: "Server is not configured correctly." },
      500
    )
  }

  const authHeader = req.headers.get("Authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim()

  if (!token) {
    return json({ error: "Missing Authorization header." }, 401)
  }

  // Verify the logged-in user
  const caller = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      },
    },
    auth: {
      persistSession: false,
    },
  })

  const {
    data: callerData,
    error: callerError,
  } = await caller.auth.getUser()

  if (callerError || !callerData.user) {
    return json({ error: "Unauthorized." }, 401)
  }

  // Check that the caller is a Super Admin
  const { data: profile, error: profileLookupError } =
    await caller
      .from("profiles")
      .select("role")
      .eq("id", callerData.user.id)
      .maybeSingle()

  if (profileLookupError) {
    return json(
      { error: profileLookupError.message },
      500
    )
  }

  if (!profile || profile.role !== "super-admin") {
    return json(
      {
        error:
          "Only platform administrators can manage owner logins.",
      },
      403
    )
  }

  // Read request body
  let body: InviteRequest

  try {
    body = (await req.json()) as InviteRequest
  } catch {
    return json(
      { error: "Request body must be valid JSON." },
      400
    )
  }

  const gymId = body.gymId?.trim()
  const gymName = body.gymName?.trim()
  const ownerName = body.ownerName?.trim()
  const email = body.email?.trim().toLowerCase()
  const password = body.password?.trim()

  // Validate required fields
  if (!gymId || !gymName || !ownerName || !email) {
    return json(
      {
        error:
          "gymId, gymName, ownerName and email are required.",
      },
      400
    )
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Please provide a valid email address." }, 400)
  }

  // Validate gym UUID
  if (!isValidUuid(gymId)) {
    return json(
      {
        error: `Invalid gym ID: ${gymId}`,
      },
      400
    )
  }

  // Service-role client
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
    },
  })

  // Make sure the gym exists
  const { data: gym, error: gymError } = await admin
    .from("gyms")
    .select("id, name")
    .eq("id", gymId)
    .maybeSingle()

  if (gymError) {
    return json(
      { error: gymError.message },
      500
    )
  }

  if (!gym) {
    return json(
      {
        error:
          "The selected gym does not exist.",
      },
      404
    )
  }

  // Check if this gym already has an owner
  const { data: existing, error: existingError } =
    await admin
      .from("profiles")
      .select("id, email")
      .eq("gym_id", gymId)
      .eq("role", "gym-owner")
      .maybeSingle()

  if (existingError) {
    return json(
      { error: existingError.message },
      500
    )
  }

  // Update existing owner
  if (existing) {
    const emailChanged =
      (existing.email ?? "").toLowerCase() !== email

    if (emailChanged || password) {
      const updatePayload: {
        email?: string
        password?: string
      } = {}

      if (emailChanged) {
        updatePayload.email = email
      }

      if (password) {
        updatePayload.password = password
      }

      const {
        error: updateAuthError,
      } = await admin.auth.admin.updateUserById(
        existing.id,
        updatePayload
      )

      if (updateAuthError) {
        return json(
          { error: updateAuthError.message },
          400
        )
      }
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        name: ownerName,
        gym_name: gymName,
        email,
        gym_id: gymId,
        role: "gym-owner",
      })
      .eq("id", existing.id)

    if (profileError) {
      return json(
        { error: profileError.message },
        400
      )
    }

    return json({
      userId: existing.id,
      email,
      name: ownerName,
      role: "gym-owner",
      gymId,
      gymName,
    })
  }

  // Check whether email is already used
  const {
    data: conflicting,
    error: conflictingError,
  } = await admin
    .from("profiles")
    .select("id, role")
    .eq("email", email)
    .maybeSingle()

  if (conflictingError) {
    return json(
      { error: conflictingError.message },
      500
    )
  }

  if (conflicting) {
    return json(
      {
        error:
          "That email already has a GymSOS account.",
      },
      409
    )
  }

  if (!password) {
    return json(
      {
        error: "A password is required to create a new owner login.",
      },
      400
    )
  }

  // Create Auth user
  const {
    data: authData,
    error: authError,
  } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: ownerName,
    },
  })

  if (authError || !authData.user) {
    return json(
      {
        error:
          authError?.message ??
          "Could not create the owner account.",
      },
      400
    )
  }

  // Link Auth user to gym
  const {
    error: linkError,
  } = await admin
    .from("profiles")
    .update({
      role: "gym-owner",
      gym_id: gymId,
      gym_name: gymName,
      name: ownerName,
      email,
    })
    .eq("id", authData.user.id)

  // If profile linking fails, remove the Auth user
  if (linkError) {
    await admin.auth.admin.deleteUser(
      authData.user.id
    )

    return json(
      {
        error:
          `Could not link owner to gym: ${linkError.message}`,
      },
      400
    )
  }

  return json({
    userId: authData.user.id,
    email,
    name: ownerName,
    role: "gym-owner",
    gymId,
    gymName,
  })
})