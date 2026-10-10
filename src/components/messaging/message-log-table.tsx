import { RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type {
  WhatsAppMessage,
  WhatsAppMessageCategory,
  WhatsAppMessageStatus,
} from "@/lib/whatsapp-messaging"

const CATEGORY_LABEL: Record<WhatsAppMessageCategory, string> = {
  fitness_daily: "Daily fitness",
  membership_expiry: "Membership expiry",
  owner_subscription_expiry: "Subscription renewal",
  test: "Test",
}

const STATUS_META: Record<
  WhatsAppMessageStatus,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }
> = {
  scheduled: { label: "Scheduled", variant: "secondary" },
  pending: { label: "Pending", variant: "secondary" },
  sending: { label: "Sending", variant: "default" },
  sent: { label: "Sent", variant: "success" },
  delivered: { label: "Delivered", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
  suppressed: { label: "Suppressed", variant: "warning" },
  cancelled: { label: "Cancelled", variant: "secondary" },
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
  }
  return phone
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

interface MessageLogTableProps {
  messages: WhatsAppMessage[]
  retryingId: string | null
  onRetry: (messageId: string) => void
}

/**
 * The Super Admin message log — every
 * queued, sent, failed or suppressed
 * WhatsApp message with its outcome.
 * Failed rows carry a safe retry button
 * (the retry re-queues the same row and
 * re-checks eligibility, so it can never
 * duplicate a message).
 */
export function MessageLogTable({
  messages,
  retryingId,
  onRetry,
}: MessageLogTableProps) {
  if (messages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        <p className="font-display text-base font-semibold text-foreground">
          No messages yet
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          WhatsApp messages appear here once the integration is
          configured and messaging is switched on.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-premium">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
            <th className="px-5 py-3 font-medium">Recipient</th>
            <th className="px-5 py-3 font-medium">Category</th>
            <th className="px-5 py-3 font-medium">Template</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Reason</th>
            <th className="px-5 py-3 font-medium">Scheduled</th>
            <th className="px-5 py-3 font-medium">Sent</th>
            <th className="px-5 py-3 font-medium">Attempts</th>
            <th className="px-5 py-3 font-medium">Cost (₹)</th>
            <th className="px-5 py-3 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((message) => {
            const status = STATUS_META[message.status]
            return (
              <tr
                key={message.id}
                className="border-b border-border/40 last:border-0 hover:bg-secondary/30"
              >
                <td className="px-5 py-3.5 tabular-nums text-foreground">
                  {formatPhone(message.recipientPhone)}
                </td>
                <td className="px-5 py-3.5 text-foreground">
                  {CATEGORY_LABEL[message.category]}
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">
                  {message.templateName}
                </td>
                <td className="px-5 py-3.5">
                  <Badge variant={status.variant}>{status.label}</Badge>
                </td>
                <td className="max-w-[220px] truncate px-5 py-3.5 text-muted-foreground">
                  {message.statusReason || "—"}
                </td>
                <td className="px-5 py-3.5 tabular-nums text-muted-foreground">
                  {formatDateTime(message.scheduledFor)}
                </td>
                <td className="px-5 py-3.5 tabular-nums text-muted-foreground">
                  {formatDateTime(message.sentAt)}
                </td>
                <td className="px-5 py-3.5 tabular-nums text-muted-foreground">
                  {message.attempts}
                </td>
                <td className="px-5 py-3.5 tabular-nums text-muted-foreground">
                  {message.estimatedCost.toFixed(2)}
                </td>
                <td className="px-5 py-3.5">
                  {message.status === "failed" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={retryingId === message.id}
                      onClick={() => onRetry(message.id)}
                    >
                      <RefreshCw
                        className={
                          retryingId === message.id
                            ? "size-3.5 animate-spin"
                            : "size-3.5"
                        }
                      />
                      Retry
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
