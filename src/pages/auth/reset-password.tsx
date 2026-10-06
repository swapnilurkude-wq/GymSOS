import { useEffect, useState, type SyntheticEvent } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
} from "lucide-react"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme-toggle"

type PageStatus = "loading" | "ready" | "expired" | "demo"

/**
 * Password reset page — the target of the link Supabase
 * emails after "Forgot password?". Handles both flows:
 *   PKCE    ?code=…      → exchangeCodeForSession
 *   implicit #access_token → parsed by the client itself
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate()

  const [status, setStatus] = useState<PageStatus>("loading")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setStatus("demo")
      return
    }

    let cancelled = false

    async function prepare() {
      // PKCE flow: the emailed link carries ?code=…
      const code = new URLSearchParams(window.location.search).get("code")
      if (code) {
        const { error } = await getSupabase().auth.exchangeCodeForSession(code)
        if (cancelled) return
        window.history.replaceState({}, "", "/auth/reset-password")
        setStatus(error ? "expired" : "ready")
        return
      }

      // Implicit flow: the token arrives in the URL hash,
      // which the client parses and cleans up itself.
      const { data, error } = await getSupabase().auth.getSession()
      if (cancelled) return
      if (error) {
        setStatus("expired")
        return
      }
      if (data.session) {
        setStatus("ready")
        return
      }
      // The hash may still be processing — the
      // onAuthStateChange listener below flips the page
      // to "ready" when it lands.
      if (!window.location.hash.includes("access_token=")) {
        setStatus("expired")
      }
    }

    void prepare()

    const {
      data: { subscription },
    } = getSupabase().auth.onAuthStateChange((event) => {
      if (!cancelled && event === "PASSWORD_RECOVERY") {
        setStatus("ready")
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError("New password must be at least 6 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }

    setIsSubmitting(true)
    const { error } = await getSupabase().auth.updateUser({ password })
    setIsSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    // The recovery session must not stay signed in —
    // the user signs in fresh with the new password.
    await getSupabase().auth.signOut().catch(() => {})
    setDone(true)
  }

  const heading = done
    ? "Password updated"
    : status === "ready"
      ? "Create a new password"
      : "Reset your password"

  const subtitle = done
    ? "Your password has been changed."
    : status === "ready"
      ? "Choose a strong password you haven't used before."
      : status === "loading"
        ? "Verifying your reset link…"
        : status === "demo"
          ? "Reset links are part of the hosted version."
          : "This reset link is invalid or has expired."

  return (
    <div className="relative flex min-h-svh w-full flex-col items-center justify-center bg-background px-6 py-10">
      <div className="absolute right-6 top-6 z-10">
        <ThemeToggle />
      </div>

      <div className="mb-8 flex">
        <Logo size="lg" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-[400px]"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="size-6" />
          </div>
          <h2 className="font-display text-[26px] font-bold tracking-tight text-foreground">
            {heading}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {status === "loading" && (
          <div className="flex justify-center">
            <span className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        )}

        {status === "expired" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              Reset links expire after 24 hours, or the link may have been
              used already.
            </div>
            <Button variant="outline" onClick={() => navigate("/login")}>
              <ArrowLeft className="size-4" />
              Back to sign in
            </Button>
          </div>
        )}

        {status === "demo" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              The demo running in your browser doesn't send email. Deploy the
              app with Supabase (see the README) to enable password reset.
            </p>
            <Button variant="outline" onClick={() => navigate("/login")}>
              <ArrowLeft className="size-4" />
              Back to sign in
            </Button>
          </div>
        )}

        {status === "ready" && !done && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}

        {done && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-3.5 py-2.5 text-sm text-success">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              Your password was updated successfully.
            </div>
            <Button
              onClick={() =>
                navigate("/login", { state: { resetSuccess: true }, replace: true })
              }
            >
              Continue to sign in
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
