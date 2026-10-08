import { useState, type SyntheticEvent } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  Sparkles,
  User,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { signUpGymOwner } from "@/lib/gym-owner-signup"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme-toggle"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MOBILE_PATTERN = /^[6-9]\d{9}$/

interface FormState {
  gymName: string
  ownerName: string
  mobile: string
  email: string
  password: string
  confirmPassword: string
}

const EMPTY_FORM: FormState = {
  gymName: "",
  ownerName: "",
  mobile: "",
  email: "",
  password: "",
  confirmPassword: "",
}

export default function SignupPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setError(null)
  }

  function validate(): string | null {
    if (!form.gymName.trim()) return "Gym name is required."
    if (form.gymName.trim().length > 100)
      return "Gym name must be 100 characters or fewer."
    if (!form.ownerName.trim()) return "Owner name is required."
    if (form.ownerName.trim().length > 100)
      return "Owner name must be 100 characters or fewer."
    if (!form.mobile.trim()) return "Mobile number is required."
    if (!MOBILE_PATTERN.test(form.mobile.trim()))
      return "Enter a valid 10-digit mobile number (starts with 6–9)."
    if (!form.email.trim()) return "Email address is required."
    if (!EMAIL_PATTERN.test(form.email.trim()))
      return "Enter a valid email address."
    if (form.password.length < 6)
      return "Password must be at least 6 characters."
    if (form.password !== form.confirmPassword)
      return "Passwords don't match."
    return null
  }

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault()
    setError(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await signUpGymOwner({
        gymName: form.gymName,
        ownerName: form.ownerName,
        mobile: form.mobile,
        email: form.email,
        password: form.password,
        confirmPassword: form.confirmPassword,
      })

      // Sign the new owner in through the existing
      // login flow and land them on their dashboard.
      const signedIn = await login(result.email, form.password, true)
      if (!signedIn.ok) {
        navigate("/login", {
          replace: true,
          state: { signupSuccess: result.gymName },
        })
        return
      }
      navigate("/gym-owner", { replace: true })
    } catch (signupError) {
      setError(
        signupError instanceof Error
          ? signupError.message
          : "Couldn't create your account. Please try again."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

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
        className="w-full max-w-[420px]"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Building2 className="size-6" />
          </div>
          <h2 className="font-display text-[26px] font-bold tracking-tight text-foreground">
            Start your 10-day FREE trial
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Create your gym in seconds — no payment details needed.
          </p>
        </div>

        <div className="mb-6 flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs font-medium text-foreground">
          <Sparkles className="size-3.5 text-primary" />
          Full access for 10 days · Upgrade anytime from ₹499/month
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gym-name">Gym Name</Label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="gym-name"
                autoComplete="organization"
                placeholder="Your Gym Name"
                value={form.gymName}
                onChange={(e) => update("gymName", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="owner-name">Owner Name</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="owner-name"
                autoComplete="name"
                placeholder="Your full name"
                value={form.ownerName}
                onChange={(e) => update("ownerName", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="mobile">Mobile Number</Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="10-digit mobile number"
                value={form.mobile}
                onChange={(e) => update("mobile", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="signup-email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder="you@yourgym.com"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="signup-password">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
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
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={(e) => update("confirmPassword", e.target.value)}
                className="pl-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
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

          <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1 w-full">
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Creating your gym…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="size-4" />
                Start 10-Day FREE Trial
              </span>
            )}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            Already have an account? Sign in
          </button>
        </div>
      </motion.div>
    </div>
  )
}
