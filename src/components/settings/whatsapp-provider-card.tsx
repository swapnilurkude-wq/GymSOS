import { useEffect, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  MessageSquareText,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Send,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  getWhatsAppConfigStatus,
  resetWhatsAppConfig,
  saveWhatsAppConfig,
  sendWhatsAppTest,
  setWhatsAppActive,
  type WhatsAppConfigSaveInput,
  type WhatsAppConfigStatus,
} from "@/lib/whatsapp-config"

interface FormState {
  provider: string
  phoneNumberId: string
  businessAccountId: string
  accessToken: string
  webhookSecret: string
  testRecipientPhone: string
}

const EMPTY_FORM: FormState = {
  provider: "meta-cloud-api",
  phoneNumberId: "",
  businessAccountId: "",
  accessToken: "",
  webhookSecret: "",
  testRecipientPhone: "",
}

/**
 * Super Admin WhatsApp provider configuration.
 *
 * Credentials are sent straight to the
 * whatsapp-config Edge Function, which stores
 * them encrypted (AES-256-GCM, key held in a
 * function secret). They are never returned to
 * the browser — editing re-enters only the
 * fields that changed. Activation requires a
 * successful test send first.
 */
export function WhatsAppProviderCard() {
  const [status, setStatus] = useState<WhatsAppConfigStatus | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editing, setEditing] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  const load = async () => {
    try {
      setStatus(await getWhatsAppConfigStatus())
    } catch {
      setStatus(null)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const flash = (type: "success" | "error", text: string) => {
    setMessage({ type, text })
  }

  const openEdit = (configured: boolean) => {
    setForm({
      ...EMPTY_FORM,
      // Non-secret fields are prefilled; the
      // access token is never returned by the
      // API, so it is always re-entered.
      phoneNumberId: configured ? status?.phoneNumberId ?? "" : "",
      businessAccountId: configured
        ? status?.businessAccountId ?? ""
        : "",
      testRecipientPhone: configured
        ? status?.testRecipientPhone ?? ""
        : "",
    })
    setEditing(true)
    setMessage(null)
  }

  const handleSave = async () => {
    const missing: string[] = []
    if (!form.phoneNumberId.trim()) missing.push("phone number ID")
    if (!form.accessToken.trim()) missing.push("access token")
    if (!form.testRecipientPhone.trim())
      missing.push("test recipient phone")
    if (missing.length > 0) {
      flash("error", `Required: ${missing.join(", ")}.`)
      return
    }

    setBusy(true)
    setMessage(null)
    try {
      const input: WhatsAppConfigSaveInput = {
        provider: form.provider,
        phoneNumberId: form.phoneNumberId.trim(),
        businessAccountId: form.businessAccountId.trim(),
        accessToken: form.accessToken,
        webhookSecret: form.webhookSecret.trim() || undefined,
        testRecipientPhone: form.testRecipientPhone.trim(),
      }
      await saveWhatsAppConfig(input)
      setEditing(false)
      flash(
        "success",
        "Credentials saved. Send a test message, then activate messaging."
      )
      await load()
    } catch (saveError) {
      flash(
        "error",
        saveError instanceof Error
          ? saveError.message
          : "The configuration could not be saved."
      )
    } finally {
      setBusy(false)
    }
  }

  const handleTest = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await sendWhatsAppTest("gym_sos_test")
      flash(
        "success",
        `Test message sent to ${result.sentTo} (provider id ${result.providerMessageId}).${
          result.warning ? ` Note: ${result.warning}` : ""
        } You can now activate messaging.`
      )
      await load()
    } catch (testError) {
      flash(
        "error",
        testError instanceof Error
          ? testError.message
          : "The test message failed."
      )
    } finally {
      setBusy(false)
    }
  }

  const handleToggleActive = async (active: boolean) => {
    setBusy(true)
    setMessage(null)
    try {
      await setWhatsAppActive(active)
      flash(
        "success",
        active
          ? "WhatsApp messaging is active."
          : "WhatsApp messaging is deactivated — nothing will be sent."
      )
      await load()
    } catch (toggleError) {
      flash(
        "error",
        toggleError instanceof Error
          ? toggleError.message
          : "The activation setting could not be saved."
      )
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async () => {
    setBusy(true)
    setMessage(null)
    setConfirmReset(false)
    try {
      await resetWhatsAppConfig()
      setEditing(false)
      flash(
        "success",
        "Provider configuration reset. Messaging is off."
      )
      await load()
    } catch (resetError) {
      flash(
        "error",
        resetError instanceof Error
          ? resetError.message
          : "The configuration could not be reset."
      )
    } finally {
      setBusy(false)
    }
  }

  const header = (
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <MessageSquareText className="size-4" />
        WhatsApp messaging
      </CardTitle>
      <CardDescription>
        Provider credentials for automated messages. Stored encrypted;
        the key lives in a server secret and never reaches the browser.
      </CardDescription>
    </CardHeader>
  )

  if (status === null) {
    return (
      <Card>
        {header}
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      {header}
      <CardContent className="flex flex-col gap-4">
        {!status.configured ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/20 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              WhatsApp messaging is not configured. Automated messages stay
              off until a provider is set up and a test message is sent.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              {status.active ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                  <CheckCircle2 className="size-3.5" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
                  <PauseCircle className="size-3.5" /> Inactive
                </span>
              )}
              <span className="text-sm text-muted-foreground">
                {status.provider} · phone number ID{" "}
                <span className="tabular-nums text-foreground">
                  {status.phoneNumberId}
                </span>
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Test recipient:{" "}
              <span className="tabular-nums text-foreground">
                {status.testRecipientPhone}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {status.tested
                ? `Last test: ${
                    status.lastTestedAt
                      ? new Date(status.lastTestedAt).toLocaleString(
                          "en-IN",
                          {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )
                      : "—"
                  }`
                : "No test message sent yet"}
            </div>
            {status.lastError && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="size-3.5" />
                {status.lastError}
              </div>
            )}
          </div>
        )}

        {editing ? (
          <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-secondary/20 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wa-provider">Provider</Label>
                <Select
                  value={form.provider}
                  onValueChange={(value) =>
                    setForm({ ...form, provider: value })
                  }
                >
                  <SelectTrigger id="wa-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meta-cloud-api">
                      Meta Cloud API (WhatsApp Business)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  BSP integrations (Gupshup, Twilio, 360dialog) share this
                  interface and can be added without UI changes.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wa-phone-number-id">
                  WhatsApp phone number ID
                </Label>
                <Input
                  id="wa-phone-number-id"
                  value={form.phoneNumberId}
                  onChange={(e) =>
                    setForm({ ...form, phoneNumberId: e.target.value })
                  }
                  placeholder="From the Meta Business setup"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wa-business-account">
                  Business account ID (optional)
                </Label>
                <Input
                  id="wa-business-account"
                  value={form.businessAccountId}
                  onChange={(e) =>
                    setForm({ ...form, businessAccountId: e.target.value })
                  }
                  placeholder="Meta Business Account ID"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wa-access-token">Access token</Label>
                <Input
                  id="wa-access-token"
                  type="password"
                  value={form.accessToken}
                  onChange={(e) =>
                    setForm({ ...form, accessToken: e.target.value })
                  }
                  placeholder={
                    status.configured
                      ? "Re-enter to change — never displayed"
                      : "Permanent access token"
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wa-webhook-secret">
                  Webhook secret (optional)
                </Label>
                <Input
                  id="wa-webhook-secret"
                  type="password"
                  value={form.webhookSecret}
                  onChange={(e) =>
                    setForm({ ...form, webhookSecret: e.target.value })
                  }
                  placeholder="For inbound message verification"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wa-test-recipient">
                  Test recipient phone
                </Label>
                <Input
                  id="wa-test-recipient"
                  value={form.testRecipientPhone}
                  onChange={(e) =>
                    setForm({ ...form, testRecipientPhone: e.target.value })
                  }
                  placeholder="e.g. 919820000000 — must be an opted-in admin number"
                />
                <p className="text-xs text-muted-foreground">
                  The only number the test command will ever message.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleSave} disabled={busy}>
                <KeyRound className="size-4" />
                Save credentials
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditing(false)}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {!status.configured ? (
              <Button onClick={() => openEdit(false)} disabled={busy}>
                <KeyRound className="size-4" />
                Set up provider
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={busy}
                >
                  <Send className="size-4" />
                  Send test message
                </Button>
                {status.active ? (
                  <Button
                    variant="outline"
                    onClick={() => void handleToggleActive(false)}
                    disabled={busy}
                  >
                    <PauseCircle className="size-4" />
                    Deactivate messaging
                  </Button>
                ) : (
                  <Button
                    onClick={() => void handleToggleActive(true)}
                    disabled={busy || !status.tested}
                    title={
                      status.tested
                        ? "Start sending automated messages"
                        : "Send a test message first"
                    }
                  >
                    <PlayCircle className="size-4" />
                    Activate messaging
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => openEdit(true)}
                  disabled={busy}
                >
                  <KeyRound className="size-4" />
                  Update credentials
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConfirmReset(true)}
                  disabled={busy}
                >
                  <RotateCcw className="size-4" />
                  Reset
                </Button>
              </>
            )}
          </div>
        )}

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
      </CardContent>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset WhatsApp configuration?</DialogTitle>
            <DialogDescription>
              This deletes the stored provider credentials and deactivates
              messaging. Queued messages stay queued but will not send
              until the integration is configured again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmReset(false)}
            >
              Keep configuration
            </Button>
            <Button variant="destructive" onClick={handleReset}>
              Reset configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
