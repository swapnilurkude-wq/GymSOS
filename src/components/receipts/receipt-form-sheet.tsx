import { useEffect, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/format"
import { blankReceiptValues, receiptToFormValues, addMonths } from "@/lib/receipt-defaults"
import { computeReceiptBalance, computeReceiptStatus, getReceiptsByMember } from "@/lib/receipts"
import { PLAN_DURATION_MONTHS, RECEIPT_PARTICULAR_LABEL } from "@/types"
import type {
  Gym,
  Member,
  MembershipPlan,
  Receipt,
  ReceiptFormValues,
  ReceiptParticular,
  ReceiptPaymentMode,
} from "@/types"

function toInputDate(iso: string): string {
  return iso ? iso.slice(0, 10) : ""
}

const STATUS_META: Record<
  "paid" | "partial" | "pending",
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  paid: { label: "Paid", variant: "success" },
  partial: { label: "Partially Paid", variant: "warning" },
  pending: { label: "Pending", variant: "destructive" },
}

interface ReceiptFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: Member[]
  defaultReceiverName: string
  receipt?: Receipt | null
  onSave: (values: ReceiptFormValues, opts: { isNewMember: boolean }) => void
  gyms?: Gym[]
  selectedGymId?: string
  onGymChange?: (gymId: string) => void
  variant?: "receipt" | "member"
}

export function ReceiptFormSheet({
  open,
  onOpenChange,
  members,
  defaultReceiverName,
  receipt = null,
  onSave,
  gyms,
  selectedGymId,
  onGymChange,
  variant = "receipt",
}: ReceiptFormSheetProps) {
  const isEditing = !!receipt
  const isMemberVariant = variant === "member"
  const showGymSelector = !!gyms
  const [isNewMember, setIsNewMember] = useState(isMemberVariant)
  const [values, setValues] = useState<ReceiptFormValues>(blankReceiptValues)

  useEffect(() => {
    if (open) {
      setIsNewMember(isMemberVariant)
      setValues(
        receipt ? receiptToFormValues(receipt) : { ...blankReceiptValues(), receiverSignature: defaultReceiverName }
      )
    }
  }, [open, receipt, defaultReceiverName, isMemberVariant])

  function update<K extends keyof ReceiptFormValues>(key: K, value: ReceiptFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function handlePaymentModeChange(mode: ReceiptPaymentMode) {
    setValues((prev) => {
      if (mode === "cash") return { ...prev, paymentMode: mode, cashAmount: prev.amountPaid, onlineAmount: 0 }
      if (mode === "online") return { ...prev, paymentMode: mode, cashAmount: 0, onlineAmount: prev.amountPaid }
      return { ...prev, paymentMode: mode, cashAmount: prev.amountPaid, onlineAmount: 0 }
    })
  }

  function handleAmountPaidChange(amountPaid: number) {
    setValues((prev) => {
      if (prev.paymentMode === "cash") return { ...prev, amountPaid, cashAmount: amountPaid }
      if (prev.paymentMode === "online") return { ...prev, amountPaid, onlineAmount: amountPaid }
      return { ...prev, amountPaid }
    })
  }

  function handleMixedSplit(field: "cashAmount" | "onlineAmount", amount: number) {
    setValues((prev) => {
      const next = { ...prev, [field]: amount }
      next.amountPaid = next.cashAmount + next.onlineAmount
      return next
    })
  }

  async function handleSelectMember(memberId: string) {
    const member = members.find((m) => m.id === memberId)
    if (!member) return

    const priorReceipts = await getReceiptsByMember(member.id)
    const latest = [...priorReceipts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]

    setValues((prev) => ({
      ...prev,
      memberId: member.id,
      memberName: member.name,
      memberContact: member.contactNumber,
      memberDob: latest?.memberDob ?? prev.memberDob,
    }))
  }

  function handlePlanChange(plan: MembershipPlan) {
    const duration = PLAN_DURATION_MONTHS[plan]
    setValues((prev) => ({
      ...prev,
      plan,
      durationMonths: duration,
      endDate: addMonths(prev.startDate, duration),
    }))
  }

  function handleStartDateChange(dateStr: string) {
    if (!dateStr) return
    const iso = new Date(dateStr).toISOString()
    setValues((prev) => ({ ...prev, startDate: iso, endDate: addMonths(iso, prev.durationMonths) }))
  }

  const balanceAmount = computeReceiptBalance(values.totalAmount, values.amountPaid)
  const status = computeReceiptStatus(values.totalAmount, values.amountPaid)

  const isMixedMismatch =
    values.paymentMode === "mixed" && values.cashAmount + values.onlineAmount !== values.amountPaid

  const canSubmit =
    (!showGymSelector || isEditing || !!selectedGymId) &&
    (isEditing || isNewMember
      ? values.memberName.trim().length > 0 && values.memberContact.trim().length > 0
      : values.memberId.length > 0) &&
    values.totalAmount > 0 &&
    values.receiverSignature.trim().length > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onSave(values, { isNewMember: !isEditing && isNewMember })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? "Edit Receipt" : isMemberVariant ? "Add New Member" : "New Receipt"}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? `Update the details for receipt ${receipt?.receiptNumber}`
              : isMemberVariant
                ? "A payment slip will be generated automatically alongside the new member"
                : "A receipt number will be generated automatically on save"}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="contents">
          <SheetBody className="flex flex-col gap-8">
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Receipt Details
                </h3>
                <Badge variant={STATUS_META[status].variant}>{STATUS_META[status].label}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Receipt number</Label>
                  <Input value={isEditing ? receipt!.receiptNumber : "Auto-generated on save"} disabled />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="receipt-date">Receipt date</Label>
                  <Input
                    id="receipt-date"
                    type="date"
                    value={toInputDate(values.receiptDate)}
                    onChange={(e) => update("receiptDate", new Date(e.target.value).toISOString())}
                  />
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Member Details
              </h3>

              {showGymSelector && (
                <div className="flex flex-col gap-2">
                  <Label>Gym *</Label>
                  {isEditing ? (
                    <Input value={gyms?.find((g) => g.id === selectedGymId)?.name ?? ""} disabled />
                  ) : (
                    <Select value={selectedGymId || undefined} onValueChange={onGymChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a gym" />
                      </SelectTrigger>
                      <SelectContent>
                        {gyms?.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {!isEditing && !isMemberVariant && (
                <SegmentedControl<"existing" | "new">
                  value={isNewMember ? "new" : "existing"}
                  onChange={(v) => setIsNewMember(v === "new")}
                  options={[
                    { value: "existing", label: "Existing Member" },
                    { value: "new", label: "New Member" },
                  ]}
                />
              )}

              {!isNewMember && !isEditing && (
                <div className="flex flex-col gap-2">
                  <Label>Select member *</Label>
                  <Select value={values.memberId || undefined} onValueChange={handleSelectMember}>
                    <SelectTrigger>
                      <SelectValue placeholder="Search and select a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} · {m.contactNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="receipt-member-name">Member name *</Label>
                  <Input
                    id="receipt-member-name"
                    value={values.memberName}
                    onChange={(e) => update("memberName", e.target.value)}
                    disabled={isEditing || !isNewMember}
                    placeholder="Full name"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="receipt-member-contact">Contact number *</Label>
                  <Input
                    id="receipt-member-contact"
                    value={values.memberContact}
                    onChange={(e) => update("memberContact", e.target.value)}
                    disabled={isEditing || !isNewMember}
                    placeholder="10-digit mobile number"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="receipt-dob">Date of birth</Label>
                  <Input
                    id="receipt-dob"
                    type="date"
                    value={toInputDate(values.memberDob)}
                    onChange={(e) =>
                      update("memberDob", e.target.value ? new Date(e.target.value).toISOString() : "")
                    }
                  />
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Membership Details
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Particular</Label>
                  <Select
                    value={values.particular}
                    onValueChange={(v) => update("particular", v as ReceiptParticular)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(RECEIPT_PARTICULAR_LABEL) as ReceiptParticular[]).map((p) => (
                        <SelectItem key={p} value={p}>
                          {RECEIPT_PARTICULAR_LABEL[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Plan type</Label>
                  <Select value={values.plan} onValueChange={(v) => handlePlanChange(v as MembershipPlan)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Quarterly">Quarterly</SelectItem>
                      <SelectItem value="Half-Yearly">Half-Yearly</SelectItem>
                      <SelectItem value="Annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="receipt-from">From date</Label>
                  <Input
                    id="receipt-from"
                    type="date"
                    value={toInputDate(values.startDate)}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="receipt-to">To date</Label>
                  <Input
                    id="receipt-to"
                    type="date"
                    value={toInputDate(values.endDate)}
                    onChange={(e) => update("endDate", new Date(e.target.value).toISOString())}
                  />
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Payment Details
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="receipt-total">Total amount *</Label>
                  <Input
                    id="receipt-total"
                    type="number"
                    min={0}
                    value={values.totalAmount}
                    onChange={(e) => update("totalAmount", Number(e.target.value))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="receipt-paid">Amount paid</Label>
                  <Input
                    id="receipt-paid"
                    type="number"
                    min={0}
                    value={values.amountPaid}
                    onChange={(e) => handleAmountPaidChange(Number(e.target.value))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Balance amount</Label>
                  <Input value={formatCurrency(balanceAmount)} disabled />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="receipt-balance-paid">Balance paid (toward earlier dues)</Label>
                  <Input
                    id="receipt-balance-paid"
                    type="number"
                    min={0}
                    value={values.balancePaid}
                    onChange={(e) => update("balancePaid", Number(e.target.value))}
                  />
                </div>
                {balanceAmount > 0 && (
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor="receipt-balance-due">Balance due date</Label>
                    <Input
                      id="receipt-balance-due"
                      type="date"
                      value={toInputDate(values.balanceDueDate)}
                      onChange={(e) =>
                        update("balanceDueDate", e.target.value ? new Date(e.target.value).toISOString() : "")
                      }
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label>Payment mode</Label>
                <SegmentedControl<ReceiptPaymentMode>
                  value={values.paymentMode}
                  onChange={handlePaymentModeChange}
                  options={[
                    { value: "cash", label: "Cash" },
                    { value: "online", label: "Online" },
                    { value: "mixed", label: "Mixed" },
                  ]}
                />
              </div>

              {values.paymentMode === "mixed" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="receipt-cash-amount">Cash amount</Label>
                    <Input
                      id="receipt-cash-amount"
                      type="number"
                      min={0}
                      value={values.cashAmount}
                      onChange={(e) => handleMixedSplit("cashAmount", Number(e.target.value))}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="receipt-online-amount">Online amount</Label>
                    <Input
                      id="receipt-online-amount"
                      type="number"
                      min={0}
                      value={values.onlineAmount}
                      onChange={(e) => handleMixedSplit("onlineAmount", Number(e.target.value))}
                    />
                  </div>
                  {isMixedMismatch && (
                    <p className="text-xs text-warning sm:col-span-2">
                      Cash + online should add up to the amount paid ({formatCurrency(values.amountPaid)}).
                    </p>
                  )}
                </div>
              )}

              {values.paymentMode !== "cash" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="receipt-transaction-id">Transaction ID</Label>
                  <Input
                    id="receipt-transaction-id"
                    value={values.transactionId}
                    onChange={(e) => update("transactionId", e.target.value)}
                    placeholder="UTR / reference number"
                  />
                </div>
              )}
            </section>

            <section className="flex flex-col gap-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Optional Services
              </h3>
              <div className="flex flex-wrap gap-5">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <Checkbox
                    checked={values.nutrition}
                    onCheckedChange={(v) => update("nutrition", v === true)}
                  />
                  <span className="text-sm text-foreground">Nutrition</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2.5">
                  <Checkbox
                    checked={values.personalTraining}
                    onCheckedChange={(v) => update("personalTraining", v === true)}
                  />
                  <span className="text-sm text-foreground">Personal Training (PT)</span>
                </label>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Notes & Signatures
              </h3>
              <div className="flex flex-col gap-2">
                <Label htmlFor="receipt-notes">Notes / remarks</Label>
                <Textarea
                  id="receipt-notes"
                  value={values.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="Optional notes for this receipt"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="receipt-customer-sign">Customer signature</Label>
                  <Input
                    id="receipt-customer-sign"
                    value={values.customerSignature}
                    onChange={(e) => update("customerSignature", e.target.value)}
                    placeholder="Customer's typed name"
                    className={cn(values.customerSignature && "font-serif italic")}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="receipt-receiver-sign">Authorized receiver signature *</Label>
                  <Input
                    id="receipt-receiver-sign"
                    value={values.receiverSignature}
                    onChange={(e) => update("receiverSignature", e.target.value)}
                    placeholder="Staff / owner name"
                    className={cn(values.receiverSignature && "font-serif italic")}
                  />
                </div>
              </div>
            </section>
          </SheetBody>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isEditing ? "Save Changes" : isMemberVariant ? "Add Member" : "Generate Receipt"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="inline-flex rounded-lg border border-border/70 bg-secondary/40 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
            value === opt.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
