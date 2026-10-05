import { Dumbbell } from "lucide-react"
import { cn } from "@/lib/utils"

export function Logo({
  className,
  iconOnly = false,
  size = "default",
  variant = "default",
}: {
  className?: string
  iconOnly?: boolean
  size?: "default" | "lg"
  variant?: "default" | "light"
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 shadow-glow",
          size === "lg" ? "size-11" : "size-9"
        )}
      >
        <Dumbbell className={cn("text-white", size === "lg" ? "size-5.5" : "size-4.5")} strokeWidth={2.25} />
      </div>
      {!iconOnly && (
        <span
          className={cn(
            "font-display font-bold tracking-tight",
            variant === "light" ? "text-white" : "text-foreground",
            size === "lg" ? "text-2xl" : "text-xl"
          )}
        >
          Gym
          <span className={variant === "light" ? "text-white/70" : "text-gradient-brand"}>SOS</span>
        </span>
      )}
    </div>
  )
}
