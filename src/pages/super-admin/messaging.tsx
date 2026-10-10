import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  MessageSquareText,
  PauseCircle,
  Send,
  ShieldAlert,
  XCircle,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/shared/stat-card"
import { DataErrorBanner } from "@/components/shared/data-error-banner"
import { MessageLogTable } from "@/components/messaging/message-log-table"
import {
  getMessagingOverview,
  retryWhatsAppMessage,
  setGlobalMessagingPaused,
  setGymMessagingPaused,
  type MessagingOverview,
  type RetryResult,
} from "@/lib/whatsapp-messaging"
import { getWhatsAppConfigStatus } from "@/lib/whatsapp-config"
import type { WhatsAppConfigStatus } from "@/lib/whatsapp-config"

/** "HH:MM:SS" → "09:00" for display. */
function formatTimeWindow(start: string, end: string): string {
  const cut = (time: string) => time.slice(0, 5)
  return `${cut(start)}–${cut(end)}`
}

function ConnectionStatus({ status }: { status: WhatsAppConfigStatus | null }) {
  if (!status) return null

  if (!status.configured) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary">Not configured</Badge>
        <p className="text-sm text-muted-foreground">
          WhatsApp messaging is off until a provider is configured and a test
          message is sent. Credentials live in{" "}
          <span className="font-medium text-foreground">Settings</span>.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-2">
        {status.active ? (
          <Badge variant="success">
            <CheckCircle2 className="size-3" /> Active
          </Badge>
        ) : (
          <Badge variant="warning">
            <PauseCircle className="size-3" /> Inactive
          </Badge>
        )}
        <span className="text-sm text-muted-foreground">
          {status.provider} · phone number ID {status.phoneNumberId}
        </span>
      </div>
      {status.tested && (
        <span className="text-xs text-muted-foreground">
          Last test:{" "}
          {status.lastTestedAt
            ? new Date(status.lastTestedAt).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—"}
        </span>
      )}
      {status.lastError && (
        <span className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="size-3.5" />
          {status.lastError}
        </span>
      )}
    </div>
  )
}

export default function SuperAdminMessagingPage() {
  const [overview, setOverview] = useState<MessagingOverview | null>(null)
  const [configStatus, setConfigStatus] = useState<WhatsAppConfigStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [messaging, config] = await Promise.all([
        getMessagingOverview(),
        getWhatsAppConfigStatus(),
      ])
      setOverview(messaging)
      setConfigStatus(config)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The messaging overview failed to load."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const flash = (type: "success" | "error", text: string) => {
    setActionMessage({ type, text })
  }

  const handleGlobalPause = async (paused: boolean) => {
    if (!overview) return
    // Optimistic update — rolled back on failure.
    setOverview({
      ...overview,
      controls: { ...overview.controls, globalPaused: paused },
    })
    try {
      await setGlobalMessagingPaused(paused)
      flash(
        "success",
        paused
          ? "All WhatsApp messaging paused. Queued messages stay queued."
          : "WhatsApp messaging resumed."
      )
    } catch (pauseError) {
      setOverview({
        ...overview,
        controls: { ...overview.controls, globalPaused: !paused },
      })
      flash(
        "error",
        pauseError instanceof Error
          ? pauseError.message
          : "The pause setting could not be saved."
      )
    }
  }

  const handleGymPause = async (gymId: string, gymName: string, paused: boolean) => {
    if (!overview) return
    const previous = overview.gyms.map((gym) =>
      gym.gymId === gymId ? { ...gym, paused } : gym
    )
    setOverview({ ...overview, gyms: previous })
    try {
      await setGymMessagingPaused(gymId, paused)
      flash(
        "success",
        paused
          ? `Member messaging paused for ${gymName}.`
          : `Member messaging resumed for ${gymName}.`
      )
    } catch (pauseError) {
      setOverview({
        ...overview,
        gyms: overview.gyms.map((gym) =>
          gym.gymId === gymId ? { ...gym, paused: !paused } : gym
        ),
      })
      flash(
        "error",
        pauseError instanceof Error
          ? pauseError.message
          : "The gym pause setting could not be saved."
      )
    }
  }

  const handleRetry = async (messageId: string) => {
    setRetryingId(messageId)
    try {
      const result: RetryResult = await retryWhatsAppMessage(messageId)
      if (result.outcome === "sent") {
        flash("success", "Message re-sent.")
      } else if (result.outcome === "deferred") {
        flash("success", `Eligible again — will send when conditions allow (${result.reason}).`)
      } else {
        flash("error", `Still blocked: ${result.reason}`)
      }
      await load()
    } catch (retryError) {
      flash(
        "error",
        retryError instanceof Error
          ? retryError.message
          : "The retry failed."
      )
    } finally {
      setRetryingId(null)
    }
  }

  const stats = overview?.stats

  return (
    <div className="flex flex-col gap-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1"
      >
        <h1 className="font-display text-xl font-semibold text-foreground">
          WhatsApp Messaging
        </h1>
        <p className="text-sm text-muted-foreground">
          Provider connection, delivery volume, failures and the message queue
        </p>
      </motion.div>

      <DataErrorBanner error={error} onRetry={load} />

      {actionMessage && (
        <div
          className={
            actionMessage.type === "success"
              ? "flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
              : "flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          }
        >
          {actionMessage.type === "success" ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : (
            <XCircle className="size-4 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}
      {actionMessage && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setActionMessage(null)}
          className="-mt-3 self-end text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Dismiss
        </button>
      )}

      {/* Provider connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareText className="size-4" />
            Provider connection
          </CardTitle>
          <CardDescription>
            Managed by the Super Admin in Settings — credentials never appear
            here
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !configStatus ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ConnectionStatus status={configStatus} />
          )}
        </CardContent>
      </Card>

      {/* Volume */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Send}
          label="Messages (30 days)"
          value={stats?.total ?? 0}
          tone="brand"
          index={0}
        />
        <StatCard
          icon={CheckCircle2}
          label="Delivered"
          value={stats?.delivered ?? 0}
          tone="success"
          index={1}
        />
        <StatCard
          icon={AlertCircle}
          label="Failed"
          value={stats?.failed ?? 0}
          tone="danger"
          index={2}
        />
        <StatCard
          icon={ShieldAlert}
          label="Suppressed"
          value={stats?.suppressed ?? 0}
          tone="warning"
          index={3}
        />
      </div>

      {/* Platform controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PauseCircle className="size-4" />
            Platform controls
          </CardTitle>
          <CardDescription>
            Emergency brake for all automated WhatsApp messaging
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !overview ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <div className="flex items-center gap-3">
                <Switch
                  checked={overview?.controls.globalPaused ?? false}
                  onCheckedChange={handleGlobalPause}
                  aria-label="Pause all WhatsApp messaging"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Global pause
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {overview?.controls.globalPaused
                      ? "Paused — eligible messages stay queued"
                      : "Off — messages dispatch on schedule"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="size-4" />
                Business hours{" "}
                {overview
                  ? formatTimeWindow(
                      overview.controls.businessHoursStart,
                      overview.controls.businessHoursEnd
                    )
                  : "—"}{" "}
                · cap {overview?.controls.dailySendCap ?? "—"}/day ·{" "}
                {overview?.controls.timezone ?? "—"}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-gym pause */}
      <Card>
        <CardHeader>
          <CardTitle>Per-gym messaging</CardTitle>
          <CardDescription>
            Pausing a gym blocks member messages for that gym only — the
            owner's own subscription reminders are unaffected
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !overview ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {overview?.gyms.map((gym) => (
                <div
                  key={gym.gymId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/20 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {gym.gymName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {gym.gymStatus}
                      {gym.paused ? " · messaging paused" : ""}
                    </p>
                  </div>
                  <Switch
                    checked={gym.paused}
                    onCheckedChange={(paused) =>
                      void handleGymPause(gym.gymId, gym.gymName, paused)
                    }
                    aria-label={`Pause messaging for ${gym.gymName}`}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message log */}
      <Card>
        <CardHeader>
          <CardTitle>Message log</CardTitle>
          <CardDescription>
            Recent messages with delivery outcomes and suppression reasons
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !overview ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <MessageLogTable
              messages={overview?.log ?? []}
              retryingId={retryingId}
              onRetry={handleRetry}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
