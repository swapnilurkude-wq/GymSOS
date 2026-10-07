import { SUPABASE_URL, getSupabase, isSupabaseConfigured } from "@/lib/supabase"
import { type ProfileRow } from "@/lib/supabase-rows"
import { STORAGE_KEYS, readStorage, writeStorage } from "@/lib/storage"
import type { AuthUser } from "@/types"

function getAllUsers(): AuthUser[] {
  return readStorage<AuthUser[]>(STORAGE_KEYS.users, [])
}

function persistAll(users: AuthUser[]): void {
  writeStorage(STORAGE_KEYS.users, users)
}

export function updateUserProfile(
  userId: string,
  updates: { name: string; avatarUrl?: string }
): AuthUser | null {
  const users = getAllUsers()
  const index = users.findIndex((u) => u.id === userId)
  if (index === -1) return null

  const updated: AuthUser = { ...users[index], ...updates }
  const next = [...users]
  next[index] = updated
  persistAll(next)
  return updated
}

export function updateUserGymName(userId: string, gymName: string): void {
  const users = getAllUsers()
  const index = users.findIndex((u) => u.id === userId)
  if (index === -1) return

  const next = [...users]
  next[index] = { ...next[index], gymName }
  persistAll(next)
}

export function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): { ok: true } | { ok: false; message: string } {
  const users = getAllUsers()
  const index = users.findIndex((u) => u.id === userId)
  if (index === -1) return { ok: false, message: "User not found." }

  if (users[index].password !== currentPassword) {
    return { ok: false, message: "Current password is incorrect." }
  }

  const next = [...users]
  next[index] = { ...next[index], password: newPassword }
  persistAll(next)
  return { ok: true }
}

function toAuthUser(profile: ProfileRow): AuthUser {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email ?? "",
    password: "", // Supabase Auth owns passwords
    role: profile.role as AuthUser["role"],
    avatarUrl: profile.avatar_url ?? undefined,
    gymId: profile.gym_id ?? undefined,
    gymName: profile.gym_name ?? undefined,
    createdAt: profile.created_at,
  }
}

export async function findUserByEmail(
  email: string,
  excludeUserId?: string
): Promise<AuthUser | undefined> {
  const target = email.trim().toLowerCase()

  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from("profiles")
      .select("*")
      .eq("email", target)
      .maybeSingle()
    if (error || !data) return undefined
    const user = toAuthUser(data as ProfileRow)
    return excludeUserId && user.id === excludeUserId ? undefined : user
  }

  return getAllUsers().find(
    (u) => u.email.toLowerCase() === target && u.id !== excludeUserId
  )
}

export async function findUserByGymId(gymId: string): Promise<AuthUser | undefined> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from("profiles")
      .select("*")
      .eq("gym_id", gymId)
      .eq("role", "gym-owner")
      .maybeSingle()
    if (error || !data) return undefined
    return toAuthUser(data as ProfileRow)
  }

  return getAllUsers().find((u) => u.gymId === gymId)
}

export function generatePassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  let out = ""
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

export async function upsertGymOwnerAccount(params: {
  gymId: string
  gymName: string
  ownerName: string
  email: string
  password?: string
}): Promise<AuthUser> {
  if (isSupabaseConfigured()) {
    // Creating auth users needs the service role key, which
    // must never ship to the browser — so this delegates to
    // the invite-gym-owner Edge Function, gated there to
    // super-admins.
    const { data: authSession } = await getSupabase().auth.getSession()
    const accessToken = authSession.session?.access_token
    if (!accessToken) {
      throw new Error("You must be signed in to manage owner logins.")
    }

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/invite-gym-owner`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(params),
      }
    )

    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload.error) {
      throw new Error(
        typeof payload.error === "string"
          ? payload.error
          : "The owner login couldn't be created."
      )
    }

    return {
      id: payload.userId,
      name: params.ownerName,
      email: payload.email ?? params.email,
      password: "", // Supabase Auth owns passwords
      role: "gym-owner",
      gymId: params.gymId,
      gymName: params.gymName,
      createdAt: new Date().toISOString(),
    }
  }

  const users = getAllUsers()
  const index = users.findIndex((u) => u.gymId === params.gymId)
  const existing = index >= 0 ? users[index] : null

  if (!existing && !params.password) {
    throw new Error("A password is required to create a new login account.")
  }

  const account: AuthUser = {
    id: existing?.id ?? crypto.randomUUID(),
    name: params.ownerName,
    email: params.email,
    password: params.password ?? existing!.password,
    role: "gym-owner",
    gymId: params.gymId,
    gymName: params.gymName,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  }

  const next = [...users]
  if (index >= 0) next[index] = account
  else next.push(account)
  persistAll(next)
  return account
}
