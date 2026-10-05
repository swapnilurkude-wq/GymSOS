import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import { AlertTriangle, CheckCircle2, Plus, Settings2, X } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useMembers } from "@/hooks/use-members"
import { useReceipts } from "@/hooks/use-receipts"
import { DataErrorBanner } from "@/components/shared/data-error-banner"
import { Button } from "@/components/ui/button"
import { ReceiptToolbar, type ReceiptFilters } from "@/components/receipts/receipt-toolbar"
import { ReceiptTable } from "@/components/receipts/receipt-table"
import { ReceiptFormSheet } from "@/components/receipts/receipt-form-sheet"
import { useReceiptTemplate } from "@/hooks/use-receipt-template"
import { memberValuesFromReceiptForm } from "@/lib/members"
import { printReceiptDocument, downloadReceiptDocumentPdf } from "@/lib/receipt-pdf"
import { isSameDay, isSameMonth, isWithinLastDays } from "@/lib/payments"
import type { Receipt, ReceiptFormValues } from "@/types"

const DEFAULT_FILTERS: ReceiptFilters = { search: "", status: "all", paymentMode: "all", range: "all" }

export default function GymOwnerReceiptsPage() {
  const { session } = useAuth()
  const gymId = session?.gymId ?? ""
  const gymName = session?.gymName ?? "Your Gym"
  const { members, error: membersError, refresh: refreshMembers, addMember, editMember } = useMembers(gymId)
  const { receipts, error: receiptsError, refresh: refreshReceipts, addReceipt } = useReceipts(gymId)
  const template = useReceiptTemplate(gymId)

  const [filters, setFilters] = useState<ReceiptFilters>(DEFAULT_FILTERS)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const filteredReceipts = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    const now = new Date()
    return [...receipts]
      .filter((r) => {
        if (query) {
          const haystack = `${r.memberName} ${r.receiptNumber}`.toLowerCase()
          if (!haystack.includes(query)) return false
        }
        if (filters.status !== "all" && r.status !== filters.status) return false
        if (filters.paymentMode !== "all" && r.paymentMode !== filters.paymentMode) return false
        if (filters.range === "today" && !isSameDay(r.receiptDate, now)) return false
        if (filters.range === "week" && !isWithinLastDays(r.receiptDate, 7, now)) return false
        if (filters.range === "month" && !isSameMonth(r.receiptDate, now)) return false
        return true
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [receipts, filters])

  function openAddForm() {
    setSheetOpen(true)
  }

  async function handleSave(values: ReceiptFormValues, opts: { isNewMember: boolean }) {
    let memberId = values.memberId

    if (opts.isNewMember) {
      const created = await addMember(memberValuesFromReceiptForm(values))
      memberId = created.id
    } else if (values.particular === "renewal") {
      const member = members.find((m) => m.id === values.memberId)
      if (member) {
        await editMember(member.id, {
          photoUrl: member.photoUrl,
          name: member.name,
          contactNumber: member.contactNumber,
          gender: member.gender,
          address: member.address,
          memberType: "renewal",
          plan: values.plan,
          durationMonths: values.durationMonths,
          startDate: values.startDate,
          endDate: values.endDate,
          amount: values.totalAmount,
          discount: 0,
          paidAmount: member.paidAmount + values.amountPaid,
          paymentMode: values.paymentMode,
          cashAmount: member.cashAmount + values.cashAmount,
          onlineAmount: member.onlineAmount + values.onlineAmount,
          paymentReceiver: values.receiverSignature,
          paymentDate: values.receiptDate,
          notes: values.notes,
          termsAccepted: member.termsAccepted,
        })
      }
    }

    const created = await addReceipt({ ...values, memberId })
    setBanner({ type: "success", text: `Receipt ${created.receiptNumber} was generated successfully.` })
    setSheetOpen(false)
  }

  function handlePrint(receipt: Receipt) {
    if (!template) return
    printReceiptDocument(receipt, template)
  }

  function handleDownload(receipt: Receipt) {
    if (!template) return
    void downloadReceiptDocumentPdf(receipt, template)
  }

  if (!template) {
    return (
      <div className="flex flex-col gap-5">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-1"
        >
          <h1 className="font-display text-xl font-semibold text-foreground">Receipts</h1>
          <p className="text-sm text-muted-foreground">Digital receipts for every payment</p>
        </motion.div>

        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-warning/10 text-warning">
            <AlertTriangle className="size-6" />
          </div>
          <div>
            <p className="font-display text-base font-semibold text-foreground">
              Set up your receipt template first
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Add your gym's logo, address, and terms once — it's used automatically on every receipt from
              then on.
            </p>
          </div>
          <Button asChild>
            <Link to="/gym-owner/settings">
              <Settings2 className="size-4" />
              Set up template
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground">Receipts</h1>
          <p className="text-sm text-muted-foreground">{receipts.length} receipts generated at {gymName}</p>
        </div>
        <Button onClick={openAddForm}>
          <Plus className="size-4" />
          New Receipt
        </Button>
      </motion.div>

      <DataErrorBanner error={membersError} onRetry={refreshMembers} />
      <DataErrorBanner error={receiptsError} onRetry={refreshReceipts} />

      {banner && (
        <div
          className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            banner.type === "success"
              ? "border-success/30 bg-success/10 text-success"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          <div className="flex items-start gap-2">
            {banner.type === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            )}
            {banner.text}
          </div>
          <button onClick={() => setBanner(null)} aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      )}

      <ReceiptToolbar filters={filters} onFiltersChange={setFilters} />

      <ReceiptTable receipts={filteredReceipts} onPrint={handlePrint} onDownload={handleDownload} />

      <ReceiptFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        members={members}
        defaultReceiverName={template.authorizedSignatureName || session?.name || ""}
        onSave={handleSave}
      />
    </div>
  )
}
