import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Gym } from "@/types"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

interface RenewDialogProps {
  gym: Gym | null
  onOpenChange: (open: boolean) => void
  onConfirm: (gym: Gym, newEndDate: string) => void
}

/**
 * Renewal is fully manual — the admin picks the new
 * date and nothing is calculated or pre-selected.
 */
export function RenewDialog({ gym, onOpenChange, onConfirm }: RenewDialogProps) {
  const [date, setDate] = useState("")

  // Start from an empty date every time the dialog
  // opens, so the choice is always deliberate.
  useEffect(() => {
    if (gym) setDate("")
  }, [gym])

  const dateValid = date.length > 0 && !Number.isNaN(new Date(date).getTime())

  return (
    <Dialog open={!!gym} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renew subscription</DialogTitle>
          <DialogDescription>
            Choose the new renewal date for {gym?.name}. Nothing is calculated
            automatically — the date is entirely up to you.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3.5 py-2.5 text-sm">
            <span className="text-muted-foreground">Current renewal date</span>
            <span className="font-medium text-foreground">
              {gym ? formatDate(gym.subscriptionEndDate) : "—"}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="renewal-date">New renewal / expiry date *</Label>
            <Input
              id="renewal-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!dateValid}
            onClick={() => {
              if (gym) onConfirm(gym, date)
            }}
          >
            {dateValid
              ? `Renew until ${formatDate(new Date(date).toISOString())}`
              : "Renew"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
