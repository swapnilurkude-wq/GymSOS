import { useEffect, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  getMemberWhatsAppOptin,
  saveMemberWhatsAppOptin,
  normalizeWhatsAppNumber,
  type MemberWhatsappOptinValues,
} from "@/lib/owner-whatsapp"
import type { Member } from "@/types"

interface MemberWhatsappDialogProps {
  member: Member | null
  gymId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (optin: MemberWhatsappOptinValues) => void
}

/**
 * Manages an existing member's WhatsApp
 * opt-in. The member's consent choice is
 * recorded here — opting out immediately
 * cancels their queued messages (the
 * member_whatsapp_optins trigger).
 */
export function MemberWhatsappDialog({
  member,
  gymId,
  open,
  onOpenChange,
  onSaved,
}: MemberWhatsappDialogProps) {
  const [optedIn, setOptedIn] = useState(false)
  const [whatsappNumber, setWhatsappNumber] = useState("")
  const [fitnessDaily, setFitnessDaily] = useState(false)
  const [membershipExpiry, setMembershipExpiry] = useState(false)
  const [preferredTime, setPreferredTime] = useState("09:00")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !member) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void getMemberWhatsAppOptin(member.id)
      .then((optin) => {
        if (cancelled) return
        setOptedIn(optin?.optedIn ?? false)
        setWhatsappNumber(
          optin?.whatsappNumber || member.contactNumber
        )
        setFitnessDaily(optin?.fitnessDaily ?? false)
        setMembershipExpiry(optin?.membershipExpiry ?? false)
        setPreferredTime(
          optin?.preferredTime.slice(0, 5) || "09:00"
        )
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : "The opt-in settings failed to load."
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, member])

  const handleSave = async () => {
    if (!member) return
    setSaving(true)
    setError(null)
    try {
      const values: MemberWhatsappOptinValues = {
        whatsappNumber: normalizeWhatsAppNumber(whatsappNumber),
        optedIn,
        fitnessDaily,
        membershipExpiry,
        preferredTime: `${preferredTime}:00`,
      }
      await saveMemberWhatsAppOptin(member.id, gymId, values)
      onSaved?.(values)
      onOpenChange(false)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The opt-in settings could not be saved."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            WhatsApp updates — {member?.name}
          </DialogTitle>
          <DialogDescription>
            Record the member's consent. Opting out cancels
            their queued messages immediately.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-4 text-sm text-muted-foreground">
            Loading…
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Opted in to WhatsApp updates
                </p>
                <p className="text-xs text-muted-foreground">
                  No messages are sent without this consent
                </p>
              </div>
              <Switch
                checked={optedIn}
                onCheckedChange={setOptedIn}
                aria-label="Member opted in to WhatsApp updates"
              />
            </div>

            {optedIn && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="member-whatsapp-number">
                    WhatsApp number
                  </Label>
                  <Input
                    id="member-whatsapp-number"
                    value={whatsappNumber}
                    onChange={(e) =>
                      setWhatsappNumber(
                        e.target.value.replace(/\D/g, "")
                      )
                    }
                    placeholder="10-digit mobile number"
                  />
                </div>

                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="member-whatsapp-fitness"
                      checked={fitnessDaily}
                      onCheckedChange={(checked) =>
                        setFitnessDaily(checked === true)
                      }
                    />
                    <Label
                      htmlFor="member-whatsapp-fitness"
                      className="text-sm font-normal"
                    >
                      Daily fitness messages
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="member-whatsapp-expiry"
                      checked={membershipExpiry}
                      onCheckedChange={(checked) =>
                        setMembershipExpiry(checked === true)
                      }
                    />
                    <Label
                      htmlFor="member-whatsapp-expiry"
                      className="text-sm font-normal"
                    >
                      Membership expiry reminders
                    </Label>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="member-whatsapp-time">
                    Preferred delivery time
                  </Label>
                  <Input
                    id="member-whatsapp-time"
                    type="time"
                    value={preferredTime}
                    onChange={(e) =>
                      setPreferredTime(e.target.value)
                    }
                  />
                </div>
              </>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading || (optedIn && !whatsappNumber)}
          >
            Save opt-in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
