import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { changeUserPassword, updateUserGymName, updateUserProfile } from "@/lib/auth-users"
import { STORAGE_KEYS, readStorage, removeStorage, writeStorage } from "@/lib/storage"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"
import type { ProfileRow } from "@/lib/supabase-rows"
import type { AuthUser, Role, Session } from "@/types"

export interface AuthContextValue {
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
    nextPassword: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function toSessionFromAuthUser(user: AuthUser): Session {
  return {
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    gymId: user.gymId,
    gymName: user.gymName,
  }
}

function toSessionFromProfile(profile: ProfileRow): Session {
  return {
    userId: profile.id,
    role: profile.role as Role,
    name: profile.name,
    email: profile.email ?? "",
    avatarUrl: profile.avatar_url ?? undefined,
    gymId: profile.gym_id ?? undefined,
    gymName: profile.gym_name ?? undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const setSession = useCallback((next: Session | null) => {
    setSessionState(next)
    if (!next) {
      removeStorage(STORAGE_KEYS.session)
      return
    }
    writeStorage(STORAGE_KEYS.session, next)
  }, [])

  useEffect(() => {
    let active = true

    async function hydrate() {
      try {
        if (isSupabaseConfigured()) {
          const { data } = await getSupabase().auth.getSession()
          if (!active) return

          if (data.session?.user) {
            const { data: profile, error } = await getSupabase()
              .from("profiles")
              .select("*")
              .eq("id", data.session.user.id)
              .maybeSingle()

            if (!error && profile) {
              const next = toSessionFromProfile(profile as ProfileRow)
              setSessionState(next)
              writeStorage(STORAGE_KEYS.session, next)
              setIsLoading(false)
              return
            }
          }
        }

        const stored = readStorage<Session | null>(STORAGE_KEYS.session, null)
        setSessionState(stored)
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void hydrate()
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(
    async (
      email: string,
      password: string,
      remember = true,
    ): Promise<{ ok: true } | { ok: false; message: string }> => {
      const normalizedEmail = email.trim()

      if (isSupabaseConfigured()) {
        // This supabase-js version has no per-call persistSession
        // option — "remember" is honored through the app's own
        // session storage below.
        const { data, error } = await getSupabase().auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })

        if (error || !data.user) {
          return {
            ok: false,
            message: "Invalid email or password. Please try again.",
          }
        }

        const { data: profile, error: profileError } = await getSupabase()
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .maybeSingle()

        if (profileError || !profile) {
          return {
            ok: false,
            message:
              "This account isn't set up for GymSOS yet. Contact your platform administrator.",
          }
        }

        const next = toSessionFromProfile(profile as ProfileRow)
        setSessionState(next)
        if (remember) {
          writeStorage(STORAGE_KEYS.session, next)
        } else {
          removeStorage(STORAGE_KEYS.session)
        }
        return { ok: true }
      }

      const users = readStorage<AuthUser[]>(STORAGE_KEYS.users, [])
      const match = users.find(
        (user) =>
          user.email.toLowerCase() === normalizedEmail.toLowerCase() &&
          user.password === password,
      )

      if (!match) {
        return {
          ok: false,
          message: "Invalid email or password. Please try again.",
        }
      }

      const next = toSessionFromAuthUser(match)
      setSessionState(next)
      if (remember) {
        writeStorage(STORAGE_KEYS.session, next)
      } else {
        removeStorage(STORAGE_KEYS.session)
      }
      return { ok: true }
    },
    [],
  )

  const logout = useCallback(() => {
    if (isSupabaseConfigured()) {
      void getSupabase().auth.signOut().catch(() => {})
    }
    setSession(null)
  }, [setSession])

  const updateProfile = useCallback(
    async (updates: { name: string; avatarUrl?: string }) => {
      if (!session) return

      if (isSupabaseConfigured()) {
        await getSupabase()
          .from("profiles")
          .update({
            name: updates.name,
            avatar_url: updates.avatarUrl ?? null,
          })
          .eq("id", session.userId)
      } else {
        updateUserProfile(session.userId, updates)
      }

      const next = session
        ? {
            ...session,
            name: updates.name,
            avatarUrl: updates.avatarUrl,
          }
        : session
      setSessionState(next)
      if (next) writeStorage(STORAGE_KEYS.session, next)
    },
    [session, setSession],
  )

  const updateSessionGymName = useCallback(
    async (gymName: string) => {
      if (!session) return

      const next = { ...session, gymName }
      if (isSupabaseConfigured()) {
        await getSupabase()
          .from("profiles")
          .update({ gym_name: gymName })
          .eq("id", session.userId)
      } else {
        updateUserGymName(session.userId, gymName)
      }

      setSessionState(next)
      writeStorage(STORAGE_KEYS.session, next)
    },
    [session],
  )

  const changePassword = useCallback(
    async (
      currentPassword: string,
      nextPassword: string,
    ): Promise<{ ok: true } | { ok: false; message: string }> => {
      if (!session) {
        return { ok: false, message: "No active session." }
      }

      if (isSupabaseConfigured()) {
        const { error: signInError } = await getSupabase().auth.signInWithPassword({
          email: session.email,
          password: currentPassword,
        })

        if (signInError) {
          return { ok: false, message: "Current password is incorrect." }
        }

        const { error } = await getSupabase().auth.updateUser({ password: nextPassword })
        if (error) {
          return { ok: false, message: error.message || "Could not update the password." }
        }

        return { ok: true }
      }

      return changeUserPassword(session.userId, currentPassword, nextPassword)
    },
    [session],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      login,
      logout,
      updateProfile,
      updateSessionGymName,
      changePassword,
    }),
    [changePassword, isLoading, login, logout, session, updateProfile, updateSessionGymName],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
