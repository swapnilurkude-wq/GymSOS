import { motion } from "framer-motion"
import { useAuth } from "@/context/auth-context"
import { ProfileCard } from "@/components/settings/profile-card"
import { GymProfileCard } from "@/components/settings/gym-profile-card"
import { PlanCard } from "@/components/settings/plan-card"
import { ReceiptTemplateCard } from "@/components/settings/receipt-template-card"
import { PasswordCard } from "@/components/settings/password-card"
import { PreferencesCard } from "@/components/settings/preferences-card"

export default function GymOwnerSettingsPage() {
  const { session } = useAuth()
  if (!session) return null

  return (
    <div className="flex flex-col gap-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1"
      >
        <h1 className="font-display text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and gym preferences</p>
      </motion.div>

      <ProfileCard />
      <GymProfileCard />
      <PlanCard />
      <ReceiptTemplateCard />
      <PasswordCard />
      <PreferencesCard userId={session.userId} />
    </div>
  )
}
