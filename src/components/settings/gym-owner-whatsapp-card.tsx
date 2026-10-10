import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getOwnerMessageHistory,
  getOwnerWhatsAppSettings,
  saveOwnerWhatsAppSettings,
  requestWhatsAppVerificationCode,
  verifyWhatsAppCode,
  type OwnerMessageLogEntry,
  type OwnerWhatsAppSettings,
} from "@/lib/owner-whatsapp"

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "America/New_York", label: "New York (ET)" },
  { value: "UTC", label: "UTC" },
]

const HISTORY_CATEGORY_LABEL: Record<string, string> = {
  fitness_daily: "Daily fitness",
  membership_expiry: "Membership expiry",
  owner_subscription_expiry: "Subscription renewal",
  test: "Test",
}

const HISTORY_STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  sent: "success",
  delivered: "success",
  failed: "destructive",
  suppressed: "warning",
  scheduled: "secondary",
  pending: "secondary",
  sending: "default",
  cancelled: "secondary",
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** "HH:MM:SS" → "HH:MM" for the time input. */
function toTimeInput(time: string): string {
  return time.slice(0, 5)
}

/** "HH:MM" → "HH:MM:SS" for storage. */
function fromTimeInput(time: string): string {
  return time.length === 5 ? `${time}:00` : time
}

function timezoneOptions(current: string) {
  const known = TIMEZONES.some((tz) => tz.value === current)
  return known
    ? TIMEZONES
    : [...TIMEZONES, { value: current, label: current }]
}

export function GymOwnerWhatsAppCard() {
  const [settings, setSettings] = useState<OwnerWhatsAppSettings | null>(null)
  const [history, setHistory] = useState<OwnerMessageLogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  // Verification flow state.
  const [verifying, setVerifying] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState("")
  const [resendIn, setResendIn] = useState(0)

  // Editable settings form.
  const [whatsappNumber, setWhatsappNumber] = useState("")
  const [fitnessDaily, setFitnessDaily] = useState(false)
  const [membershipExpiry, setMembershipExpiry] = useState(false)
  const [serviceReminders, setServiceReminders] = useState(false)
  const [preferredTime, setPreferredTime] = useState("09:00")
  const [timezone, setTimezone] = useState("Asia/Kolkata")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ownerSettings, ownerHistory] = await Promise.all([
        getOwnerWhatsAppSettings(),
        getOwnerMessageHistory(),
      ])
      setSettings(ownerSettings)
      setWhatsappNumber(ownerSettings.whatsappNumber)
      setFitnessDaily(ownerSettings.fitnessDaily)
      setMembershipExpiry(ownerSettings.membershipExpiry)
      setServiceReminders(ownerSettings.serviceReminders)
      setPreferredTime(toTimeInput(ownerSettings.preferredTime))
      setTimezone(ownerSettings.timezone)
      setHistory(ownerHistory)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The WhatsApp settings failed to load."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Resend cooldown timer.
  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  const flash = (type: "success" | "error", text: string) => {
    setMessage({ type, text })
  }

  const numberChanged =
    !!settings && whatsappNumber !== settings.whatsappNumber

  const handleSendCode = async () => {
    setVerifying(true)
    setMessage(null)
    try {
      await requestWhatsAppVerificationCode(whatsappNumber.trim())
      setCodeSent(true)
      setCode("")
      setResendIn(60)
      flash(
        "success",
        `A 6-digit code was sent to ${whatsappNumber.trim()}.`
      )
    } catch (sendError) {
      flash(
        "error",
        sendError instanceof Error
          ? sendError.message
          : "The verification code could not be sent."
      )
    } finally {
      setVerifying(false)
    }
  }

  const handleVerifyCode = async () => {
    setVerifying(true)
    setMessage(null)
    try {
      const result = await verifyWhatsAppCode(code.trim())
      setCodeSent(false)
      setCode("")
      flash(
        "success",
        `${result.whatsappNumber} verified. You will now receive subscription reminders.`
      )
      await load()
    } catch (verifyError) {
      flash(
        "error",
        verifyError instanceof Error
          ? verifyError.message
          : "The code could not be verified."
      )
    } finally {
      setVerifying(false)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await saveOwnerWhatsAppSettings({
        whatsappNumber: whatsappNumber.trim(),
        fitnessDaily,
        membershipExpiry,
        serviceReminders,
        preferredTime: fromTimeInput(preferredTime),
        timezone,
      })
      flash("success", "WhatsApp settings saved.")
      if (numberChanged) {
        flash(
          "success",
          "Settings saved. The new number must be verified with a code before reminders resume."
        )
        setCodeSent(false)
      }
      await load()
    } catch (saveError) {
      flash(
        "error",
        saveError instanceof Error
          ? saveError.message
          : "The settings could not be saved."
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading && !settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareText className="size-4" />
            WhatsApp updates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareText className="size-4" />
          WhatsApp updates
        </CardTitle>
        <CardDescription>
          Your verified number, the messages you receive, and
          when they arrive
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <DataErrorBannerLight error={error} onRetry={load} />

        {message && (
          <div
            className={
              message.type === "success"
                ? "flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
                : "flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            }
          >
            {message.type === "success" ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Number verification */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">
              Your WhatsApp number
            </p>
            {settings?.isVerified ? (
              <Badge variant="success">
                <ShieldCheck className="size-3" /> Verified
              </Badge>
            ) : (
              <Badge variant="warning">Not verified</Badge>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="owner-whatsapp-number">
                Number (with country code)
              </Label>
              <Input
                id="owner-whatsapp-number"
                value={whatsappNumber}
                onChange={(e) =>
                  setWhatsappNumber(e.target.value.replace(/\D/g, ""))
                }
                placeholder="e.g. 919820000000"
                disabled={verifying}
              />
              <p className="text-xs text-muted-foreground">
                {numberChanged
                  ? "Saving a new number resets verification."
                  : "Subscription renewal reminders go to this number."}
              </p>
            </div>

            {settings?.isVerified && !codeSent ? (
              <Button
                variant="outline"
                onClick={() => {
                  setCodeSent(true)
                  setCode("")
                }}
                disabled={verifying}
              >
                Change number
              </Button>
            ) : null}
          </div>

          {codeSent ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="owner-verification-code">
                  6-digit code
                </Label>
                <Input
                  id="owner-verification-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  disabled={verifying}
                />
              </div>
              <Button
                onClick={handleVerifyCode}
                disabled={verifying || code.length !== 6}
              >
                <ShieldCheck className="size-4" />
                Verify code
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleSendCode()}
                disabled={verifying || resendIn > 0}
              >
                <RefreshCw
                  className={
                    resendIn > 0 ? "size-4 animate-spin" : "size-4"
                  }
                />
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => void handleSendCode()}
              disabled={verifying || !whatsappNumber.trim()}
            >
              <Send className="size-4" />
              Send verification code
            </Button>
          )}
        </div>

        {/* Consents */}
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-foreground">
            Messages you receive
          </p>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-foreground">
                Membership expiry reminders
              </p>
              <p className="text-xs text-muted-foreground">
                A nudge before your gym membership plan renews
              </p>
            </div>
            <Switch
              checked={membershipExpiry}
              onCheckedChange={setMembershipExpiry}
              aria-label="Membership expiry reminders"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-foreground">
                Subscription renewal reminders
              </p>
              <p className="text-xs text-muted-foreground">
                Reminders at 7, 3 and 0 days before your
                GymSOS subscription ends
              </p>
            </div>
            <Switch
              checked={serviceReminders}
              onCheckedChange={setServiceReminders}
              aria-label="Subscription renewal reminders"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-foreground">
                Daily fitness messages
              </p>
              <p className="text-xs text-muted-foreground">
                Tips and workout prompts for your members
                (requires a workout plan feature)
              </p>
            </div>
            <Switch
              checked={fitnessDaily}
              onCheckedChange={setFitnessDaily}
              aria-label="Daily fitness messages"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="owner-preferred-time">
                Preferred delivery time
              </Label>
              <Input
                id="owner-preferred-time"
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="owner-timezone">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="owner-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezoneOptions(timezone).map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" />
              Messages respect the platform's business hours
            </div>
          </div>

          <Button onClick={handleSaveSettings} disabled={saving}>
            Save settings
          </Button>
        </div>

        {/* Message history */}
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">
            Recent messages for your gym
          </p>
          {history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No messages yet — they appear here once
                messaging is configured and switched on.
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/40 rounded-xl border border-border/60">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5"
                >
                  <span className="tabular-nums text-sm text-foreground">
                    {entry.recipientPhone}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {HISTORY_CATEGORY_LABEL[entry.category] ??
                      entry.category}{" "}
                    · {entry.templateName}
                  </span>
                  <Badge
                    variant={
                      HISTORY_STATUS_VARIANT[entry.status] ?? "secondary"
                    }
                  >
                    {entry.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(entry.sentAt ?? entry.createdAt)}
                  </span>
                  {entry.statusReason && (
                    <span className="text-xs text-muted-foreground">
                      {entry.statusReason}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/** Local lightweight error banner (avoids importing the
 *  shared one twice in this card). */
function DataErrorBannerLight({
  error,
  onRetry,
}: {
  error: string | null
  onRetry: () => void
}) {
  if (!error) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <AlertCircle className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{error}</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-destructive/30 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        <RefreshCw className="size-3" />
        Retry
      </button>
    </div>
  )
}
