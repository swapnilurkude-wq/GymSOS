import { motion } from "framer-motion"
import { useAuth } from "@/context/auth-context"
import { ProfileCard } from "@/components/settings/profile-card"
import { PasswordCard } from "@/components/settings/password-card"
import { PreferencesCard } from "@/components/settings/preferences-card"
import { BackupCard } from "@/components/settings/backup-card"

export default function SuperAdminSettingsPage() {
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
        <p className="text-sm text-muted-foreground">Manage your account and platform preferences</p>
      </motion.div>

      <ProfileCard />
      <PasswordCard />
      <PreferencesCard userId={session.userId} />
      <BackupCard />
    </div>
  )
}
