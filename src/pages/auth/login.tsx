import { useState, type SyntheticEvent } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Users,
  TrendingUp,
  Receipt,
  Sparkles,
  AlertCircle,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { DEMO_CREDENTIALS } from "@/data/seed"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Logo } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { cn } from "@/lib/utils"

const FEATURES = [
  { icon: Users, text: "Complete member lifecycle management" },
  { icon: TrendingUp, text: "Real-time revenue & analytics dashboard" },
  { icon: Receipt, text: "Instant receipts, PDF & Excel export" },
  { icon: ShieldCheck, text: "Secure, role-based access control" },
]

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault()
    setError(null)

    if (!email || !password) {
      setError("Please enter both email and password.")
      return
    }

    setIsSubmitting(true)
    await new Promise((r) => setTimeout(r, 550))
    const result = await login(email, password)
    setIsSubmitting(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    const redirectTo = (location.state as { from?: string } | null)?.from
    navigate(redirectTo ?? "/", { replace: true })
  }

  function fillDemo(kind: "superAdmin" | "gymOwner") {
    setEmail(DEMO_CREDENTIALS[kind].email)
    setPassword(DEMO_CREDENTIALS[kind].password)
    setError(null)
  }

  return (
    <div className="relative flex min-h-svh w-full overflow-hidden bg-background">
      {/* Left — brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-[linear-gradient(160deg,#1a0f4d_0%,#2d1573_35%,#4c22d1_75%,#6f4dff_100%)] p-12 text-white lg:flex">
        <BackgroundOrbs />

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <Logo size="lg" variant="light" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative z-10 max-w-md"
        >
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-md">
            <Sparkles className="size-3.5" />
            Trusted by 500+ gyms across India
          </div>
          <h1 className="font-display text-4xl font-bold leading-[1.15] tracking-tight">
            Run your gym like a modern business.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            Members, payments, renewals and revenue — all in one beautifully
            simple dashboard built for gym owners.
          </p>

          <ul className="mt-8 flex flex-col gap-3.5">
            {FEATURES.map((f, i) => (
              <motion.li
                key={f.text}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.25 + i * 0.08 }}
                className="flex items-center gap-3 text-sm text-white/85"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 backdrop-blur-md">
                  <f.icon className="size-4" />
                </span>
                {f.text}
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="relative z-10 text-xs text-white/50"
        >
          © {new Date().getFullYear()} GymSOS. All rights reserved.
        </motion.div>
      </div>

      {/* Right — form panel */}
      <div className="flex w-full flex-1 flex-col items-center justify-center px-6 py-10 sm:px-10">
        <div className="absolute right-6 top-6 z-10">
          <ThemeToggle />
        </div>

        <div className="mb-8 flex lg:hidden">
          <Logo size="lg" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-[400px]"
        >
          <div className="mb-8 text-center sm:text-left">
            <h2 className="font-display text-[26px] font-bold tracking-tight text-foreground">
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in to manage your gym operations.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@yourgym.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => setError("Password reset isn't available in this demo build.")}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
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

            <label className="flex cursor-pointer items-center gap-2.5 select-none">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
              <span className="text-sm text-muted-foreground">Keep me signed in on this device</span>
            </label>

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

            <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1 w-full group">
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign in
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-7">
            <div className="relative flex items-center justify-center">
              <span className="h-px w-full bg-border" />
              <span className="absolute bg-background px-3 text-xs font-medium text-muted-foreground">
                Quick demo access
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => fillDemo("superAdmin")}
                className={cn(
                  "group rounded-xl border border-border/70 bg-secondary/40 p-3.5 text-left transition-all hover:border-primary/40 hover:bg-secondary"
                )}
              >
                <div className="mb-1.5 flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ShieldCheck className="size-3.5" />
                </div>
                <p className="text-xs font-semibold text-foreground">Super Admin</p>
                <p className="text-[11px] text-muted-foreground">Platform control</p>
              </button>
              <button
                type="button"
                onClick={() => fillDemo("gymOwner")}
                className={cn(
                  "group rounded-xl border border-border/70 bg-secondary/40 p-3.5 text-left transition-all hover:border-primary/40 hover:bg-secondary"
                )}
              >
                <div className="mb-1.5 flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Users className="size-3.5" />
                </div>
                <p className="text-xs font-semibold text-foreground">Gym Owner</p>
                <p className="text-[11px] text-muted-foreground">Iron Pulse Fitness</p>
              </button>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            GymSOS runs entirely in your browser — no data leaves this device.
          </p>
        </motion.div>
      </div>
    </div>
  )
}

function BackgroundOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute -left-24 -top-24 size-96 rounded-full bg-brand-400/30 blur-[100px] animate-float" />
      <div
        className="absolute bottom-0 right-0 size-[28rem] rounded-full bg-fuchsia-500/20 blur-[110px] animate-float"
        style={{ animationDelay: "1.5s" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)] bg-[length:28px_28px]" />
    </div>
  )
}
