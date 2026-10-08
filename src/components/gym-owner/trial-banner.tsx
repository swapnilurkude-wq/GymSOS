import { CalendarClock, Sparkles } from "lucide-react"
import { trialDaysRemaining } from "@/lib/gym-status"
import type { Gym } from "@/types"

/**
 * Small trial-status banner for the Gym Owner
 * dashboard. The countdown comes from the gym row
 * in the database, so it can't be extended by
 * changing device settings.
 */
export function TrialBanner({ gym }: { gym: Gym }) {
  const days = trialDaysRemaining(gym)

  if (days <= 3) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
        <CalendarClock className="mt-0.5 size-4 shrink-0" />
        <p>
          Your free trial expires in{" "}
          {days === 1 ? "1 day" : `${days} days`}. Upgrade now to continue
          using GymSOS.
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
      <p>
        Free Trial:{" "}
        <span className="font-semibold">{days} days remaining</span>
        <span className="text-muted-foreground">
          {" "}
          — your account activates automatically when you upgrade.
        </span>
      </p>
    </div>
  )
}
