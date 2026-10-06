import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { AuthSession, User } from "@supabase/supabase-js"
import { getSupabase, isDemoMode, isSupabaseConfigured } from "@/lib/supabase"
import { type ProfileRow } from "@/lib/supabase-rows"
import { STORAGE_KEYS, readStorage, writeStorage, removeStorage } from "@/lib/storage"
import { ensureSeeded } from "@/data/seed"
import {
  changeUserPassword,
  updateUserGymName,
  updateUserProfile,
} from "@/lib/auth-users"
import type { AuthUser, Session } from "@/types"

interface AuthContextValue {
  session: Session | null
  isLoading: boolean
  login: (
    email: string,
    password: string,
    remember?: boolean,
  ) => Promise<{ ok: true } | { ok: false; message: string }>
  logout: () => void
  updateProfile: (updates: { name: string; avatarUrl?: string }) => Promise<void>
  updateSessionGymName: (gymName: string) => Promise<void>
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ ok: true } | { ok: false; message: string }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function toSession(user: User, profile: ProfileRow): Session {
  return {
    userId: user.id,
    role: profile.role === "super-admin" ? "super-admin" : "gym-owner",
    name: profile.name || user.email || "",
    email: user.email ?? "",
    avatarUrl: profile.avatar_url ?? undefined,
    gymId: profile.gym_id ?? undefined,
    gymName: profile.gym_name ?? undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // ── Demo mode (development only) ─────────────────
    if (isDemoMode()) {
      void ensureSeeded().then(() => {
        setSession(readStorage<Session | null>(STORAGE_KEYS.session, null))
        setIsLoading(false)
      })
      return
    }

    if (!isSupabaseConfigured()) {
      // Unconfigured production build — the entry-point
      // guard renders the configuration screen, so there
      // is nothing to load here.
      setIsLoading(false)
      return
    }

    // ── Production mode: Supabase Auth + profiles ───────────
    const supabase = getSupabase()
    let cancelled = false

    async function loadFromAuthSession(authSession: AuthSession | null) {
      if (!authSession?.user) {
        if (!cancelled) {
          setSession(null)
          setIsLoading(false)
        }
        return
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authSession.user.id)
        .maybeSingle()

      if (cancelled) return

      if (error || !profile) {
        // Signed in but no profile row — the account isn't
        // provisioned for this app yet.
        setSession(null)
        setIsLoading(false)
        return
      }

      setSession(toSession(authSession.user, profile as ProfileRow))
      setIsLoading(false)
    }

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, authSession) => {
      void loadFromAuthSession(authSession)
    })

    return () => {
      cancelled = true
      authSubscription.unsubscribe()
    }
  }, [])

  const login: AuthContextValue["login"] = async (email, password, remember = true) => {
    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error || !data.user) {
        return { ok: false, message: "Invalid email or password. Please try again." }
      }

      const { data: profile, error: profileError } = await getSupabase()
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle()

      if (profileError || !profile) {
        return {
          ok: false,
          message: "This account isn't set up for GymSOS yet. Contact your platform administrator.",
        }
      }

      setSession(toSession(data.user, profile as ProfileRow))
      return { ok: true }
    }

    const users = readStorage<AuthUser[]>(STORAGE_KEYS.users, [])
    const match = users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
    )

    if (!match) {
      return { ok: false, message: "Invalid email or password. Please try again." }
    }

    const nextSession: Session = {
      userId: match.id,
      role: match.role,
      name: match.name,
      email: match.email,
      avatarUrl: match.avatarUrl,
      gymId: match.gymId,
      gymName: match.gymName,
    }

    if (remember) {
      writeStorage(STORAGE_KEYS.session, nextSession)
    } else {
      removeStorage(STORAGE_KEYS.session)
    }
    setSession(nextSession)
    return { ok: true }
  }

  const logout = () => {
    if (isSupabaseConfigured()) {
      setSession(null)
      void getSupabase().auth.signOut()
      return
    }
    removeStorage(STORAGE_KEYS.session)
    setSession(null)
  }

  const updateProfile: AuthContextValue["updateProfile"] = async (updates) => {
    if (!session) return

    if (isSupabaseConfigured()) {
      const { error } = await getSupabase()
        .from("profiles")
        .update({ name: updates.name, avatar_url: updates.avatarUrl ?? null })
        .eq("id", session.userId)
      if (!error) setSession({ ...session, ...updates })
      return
    }

    updateUserProfile(session.userId, updates)
    writeStorage(STORAGE_KEYS.session, { ...session, ...updates })
    setSession({ ...session, ...updates })
  }

  const changePassword: AuthContextValue["changePassword"] = async (
    currentPassword,
    newPassword
  ) => {
    if (!session) return { ok: false, message: "Not signed in." }

    if (isSupabaseConfigured()) {
      // Supabase verifies the current password by re-authenticating,
      // then issues the update.
      const { error: verifyError } = await getSupabase().auth.signInWithPassword({
        email: session.email,
        password: currentPassword,
      })
      if (verifyError) {
        return { ok: false, message: "Current password is incorrect." }
      }

      const { error } = await getSupabase().auth.updateUser({ password: newPassword })
      return error ? { ok: false, message: error.message } : { ok: true }
    }

    return changeUserPassword(session.userId, currentPassword, newPassword)
  }

  const updateSessionGymName: AuthContextValue["updateSessionGymName"] = async (
    gymName
  ) => {
    if (!session) return

    if (isSupabaseConfigured()) {
      const { error } = await getSupabase()
        .from("profiles")
        .update({ gym_name: gymName })
        .eq("id", session.userId)
      if (!error) setSession({ ...session, gymName })
      return
    }

    updateUserGymName(session.userId, gymName)
    writeStorage(STORAGE_KEYS.session, { ...session, gymName })
    setSession({ ...session, gymName })
  }

  return (
    <AuthContext.Provider
      value={{ session, isLoading, login, logout, updateProfile, updateSessionGymName, changePassword }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
