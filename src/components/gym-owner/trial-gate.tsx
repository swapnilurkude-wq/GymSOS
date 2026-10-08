import { useEffect, useState } from "react"
import { Outlet } from "react-router-dom"
import { motion } from "framer-motion"
import { CalendarClock, Mail, MessageCircle, Sparkles } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { getAllGyms } from "@/lib/gyms"
import { getTrialState } from "@/lib/gym-status"
import { adminMailto, whatsappUrl } from "@/lib/platform"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import type { Gym } from "@/types"

/**
 * Trial gate for the Gym Owner routes.
 *
 * The gym row — including the trial end date — is read
 * from the database, so the decision is made with
 * server-side data, not the device clock or local
 * state. An expired trial shows the upgrade screen
 * instead of the dashboard; the gym's data is never
 * touched and becomes available again once the Super
 * Admin activates a paid plan.
 */
export function TrialGate() {
  const { session } = useAuth()
  const gymId = session?.gymId
  const [gym, setGym] = useState<Gym | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!gymId) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    getAllGyms()
      .then((gyms) => {
        if (!cancelled) setGym(gyms.find((g) => g.id === gymId) ?? null)
      })
      .catch(() => {
        if (!cancelled) setGym(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [gymId])

  if (isLoading) return null

  if (gym && getTrialState(gym) === "expired") {
    return <TrialExpiredScreen gym={gym} />
  }

  return <Outlet />
}

function TrialExpiredScreen({ gym }: { gym: Gym }) {
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
        className="w-full max-w-[440px]"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CalendarClock className="size-6" />
          </div>
          <h2 className="font-display text-[26px] font-bold tracking-tight text-foreground">
            Your Free Trial Has Expired
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Your 10-day free trial for {gym.name} has ended. Upgrade GymSOS to
            continue managing your gym.
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between rounded-xl border border-border/60 bg-card px-5 py-4 shadow-premium">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              GymSOS Starter plan
            </p>
            <p className="font-display text-2xl font-bold text-foreground">
              ₹499
              <span className="text-sm font-normal text-muted-foreground">
                /month
              </span>
            </p>
          </div>
          <Sparkles className="size-5 text-primary" />
        </div>

        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            asChild
            className="w-full"
          >
            <a
              href={whatsappUrl(
                `Hi! I'd like to upgrade GymSOS for my gym "${gym.name}" (${gym.ownerEmail}). My 10-day free trial has ended.`
              )}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="size-4" />
              WhatsApp Us
            </a>
          </Button>
          <Button size="lg" variant="outline" asChild className="w-full">
            <a href={adminMailto(`GymSOS upgrade — ${gym.name}`)}>
              <Mail className="size-4" />
              Contact Admin
            </a>
          </Button>
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Your members, payments and reports are safe — they'll be available
          again as soon as your account is activated.
        </p>
      </motion.div>
    </div>
  )
}
