import { Moon, Sun } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { useTheme } from "@/context/theme-context"
import { usePreferences } from "@/hooks/use-preferences"

interface PreferencesCardProps {
  userId: string
}

const NOTIFICATION_ITEMS = [
  {
    key: "renewalReminders" as const,
    label: "Renewal reminders",
    description: "Get notified when memberships or subscriptions are due soon",
  },
  {
    key: "paymentAlerts" as const,
    label: "Payment alerts",
    description: "Get notified when a payment is received or overdue",
  },
  {
    key: "weeklyDigest" as const,
    label: "Weekly digest",
    description: "A weekly summary email of activity and revenue",
  },
]

export function PreferencesCard({ userId }: PreferencesCardProps) {
  const { theme, toggleTheme } = useTheme()
  const { preferences, updatePreference } = usePreferences(userId)

  return (
    <Card className="p-6">
      <CardHeader className="p-0">
        <CardTitle>Preferences</CardTitle>
        <CardDescription>Appearance and notification settings</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 p-0 pt-6">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Dark mode</p>
              <p className="text-xs text-muted-foreground">Switch between light and dark theme</p>
            </div>
          </div>
          <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
        </div>

        {NOTIFICATION_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center justify-between border-t border-border/60 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
            <Switch
              checked={preferences[item.key]}
              onCheckedChange={(checked) => updatePreference(item.key, checked)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
