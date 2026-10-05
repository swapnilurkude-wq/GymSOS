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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency } from "@/lib/format"
import type { CollectionMode } from "@/lib/payments"
import type { Member } from "@/types"

interface CollectPaymentDialogProps {
  member: Member | null
  onOpenChange: (open: boolean) => void
  onConfirm: (amount: number, mode: CollectionMode, receiver: string) => void
}

export function CollectPaymentDialog({ member, onOpenChange, onConfirm }: CollectPaymentDialogProps) {
  const [amount, setAmount] = useState(0)
  const [mode, setMode] = useState<CollectionMode>("cash")
  const [receiver, setReceiver] = useState("")

  useEffect(() => {
    if (member) {
      setAmount(member.balanceAmount)
      setMode("cash")
      setReceiver(member.paymentReceiver)
    }
  }, [member])

  const canSubmit = !!member && amount > 0 && amount <= (member?.balanceAmount ?? 0) && receiver.trim().length > 0

  return (
    <Dialog open={!!member} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collect payment</DialogTitle>
          <DialogDescription>
            Record a payment from {member?.name} against their outstanding balance of{" "}
            {formatCurrency(member?.balanceAmount ?? 0)}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="collect-amount">Amount collected</Label>
            <Input
              id="collect-amount"
              type="number"
              min={1}
              max={member?.balanceAmount ?? 0}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            {member && amount > member.balanceAmount && (
              <p className="text-xs text-destructive">Cannot exceed the outstanding balance.</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Payment mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as CollectionMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="collect-receiver">Received by</Label>
            <Input id="collect-receiver" value={receiver} onChange={(e) => setReceiver(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={() => onConfirm(amount, mode, receiver)}>
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
