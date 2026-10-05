import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { AlertCircle, CheckCircle2, Plus, X } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useGyms } from "@/hooks/use-gyms"
import { DataErrorBanner } from "@/components/shared/data-error-banner"
import { getAllReceipts, createReceipt, updateReceipt, deleteReceipt } from "@/lib/receipts"
import { getMembersByGym, createMember, updateMember, memberValuesFromReceiptForm } from "@/lib/members"
import { getReceiptTemplate } from "@/lib/receipt-template"
import { printReceiptDocument, downloadReceiptDocumentPdf } from "@/lib/receipt-pdf"
import { ReceiptToolbar, type ReceiptFilters } from "@/components/receipts/receipt-toolbar"
import { ReceiptTable } from "@/components/receipts/receipt-table"
import { ReceiptFormSheet } from "@/components/receipts/receipt-form-sheet"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { isSameDay, isSameMonth, isWithinLastDays } from "@/lib/payments"
import type { Member, Receipt, ReceiptFormValues } from "@/types"

const DEFAULT_FILTERS: ReceiptFilters = { search: "", status: "all", paymentMode: "all", range: "all" }

export default function SuperAdminReceiptsPage() {
  const { session } = useAuth()
  const { gyms, error: gymsError, refresh: refreshGyms } = useGyms()
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [sheetMembers, setSheetMembers] = useState<Member[]>([])
  const [filters, setFilters] = useState<ReceiptFilters>(DEFAULT_FILTERS)
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Receipt | null>(null)
  const [selectedGymId, setSelectedGymId] = useState("")

  useEffect(() => {
    let cancelled = false
    getAllReceipts()
      .then((rows) => {
        if (!cancelled) setReceipts(rows)
      })
      .catch(() => {
        if (!cancelled) setReceipts([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const gymId = editingReceipt?.gymId ?? selectedGymId
    if (!gymId) {
      setSheetMembers([])
      return
    }
    let cancelled = false
    getMembersByGym(gymId)
      .then((rows) => {
        if (!cancelled) setSheetMembers(rows)
      })
      .catch(() => {
        if (!cancelled) setSheetMembers([])
      })
    return () => {
      cancelled = true
    }
  }, [editingReceipt, selectedGymId])

  async function refreshReceipts() {
    try {
      setReceipts(await getAllReceipts())
    } catch {
      // Keep the current list when the refresh fails.
    }
  }

  const gymNameById = useMemo(
    () => Object.fromEntries(gyms.map((g) => [g.id, g.name])),
    [gyms]
  )

  const filteredReceipts = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    const now = new Date()
    return [...receipts]
      .filter((r) => {
        if (query) {
          const haystack = `${r.memberName} ${r.receiptNumber} ${gymNameById[r.gymId] ?? ""}`.toLowerCase()
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
  }, [receipts, filters, gymNameById])

  async function withTemplate(
    receipt: Receipt,
    action: (template: NonNullable<Awaited<ReturnType<typeof getReceiptTemplate>>>) => void
  ) {
    const template = await getReceiptTemplate(receipt.gymId)
    if (!template) {
      setBanner({ type: "error", text: `${gymNameById[receipt.gymId] ?? "This gym"} hasn't set up a receipt template yet.` })
      return
    }
    action(template)
  }

  function openAddForm() {
    setEditingReceipt(null)
    setSelectedGymId("")
    setSheetOpen(true)
  }

  function openEditForm(receipt: Receipt) {
    setEditingReceipt(receipt)
    setSelectedGymId(receipt.gymId)
    setSheetOpen(true)
  }

  async function handleSave(values: ReceiptFormValues, opts: { isNewMember: boolean }) {
    if (editingReceipt) {
      const updated = await updateReceipt(editingReceipt.id, values)
      setBanner({ type: "success", text: `Receipt ${updated?.receiptNumber ?? editingReceipt.receiptNumber} was updated.` })
      await refreshReceipts()
      setSheetOpen(false)
      setEditingReceipt(null)
      return
    }

    if (!selectedGymId) {
      setBanner({ type: "error", text: "Select a gym before creating a receipt." })
      return
    }

    let memberId = values.memberId

    if (opts.isNewMember) {
      const created = await createMember(selectedGymId, memberValuesFromReceiptForm(values))
      memberId = created.id
    } else if (values.particular === "renewal") {
      const member = sheetMembers.find((m) => m.id === values.memberId)
      if (member) {
        await updateMember(member.id, {
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

    const created = await createReceipt(selectedGymId, { ...values, memberId })
    setBanner({ type: "success", text: `Receipt ${created.receiptNumber} was generated successfully.` })
    await refreshReceipts()
    setSheetOpen(false)
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    await deleteReceipt(deleteTarget.id)
    setBanner({ type: "success", text: `Receipt ${deleteTarget.receiptNumber} was deleted.` })
    await refreshReceipts()
    setDeleteTarget(null)
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
          <p className="text-sm text-muted-foreground">{receipts.length} receipts issued across the platform</p>
        </div>
        <Button onClick={openAddForm}>
          <Plus className="size-4" />
          New Receipt
        </Button>
      </motion.div>

      <DataErrorBanner error={gymsError} onRetry={refreshGyms} />

      {banner && (
        <div
          className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            banner.type === "success"
              ? "border-success/30 bg-success/10 text-success"
              : "border-warning/30 bg-warning/10 text-warning"
          }`}
        >
          <div className="flex items-start gap-2">
            {banner.type === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
            )}
            {banner.text}
          </div>
          <button onClick={() => setBanner(null)} aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      )}

      <ReceiptToolbar filters={filters} onFiltersChange={setFilters} />

      <ReceiptTable
        receipts={filteredReceipts}
        gymNameById={gymNameById}
        onPrint={(receipt) => void withTemplate(receipt, (template) => printReceiptDocument(receipt, template))}
        onDownload={(receipt) =>
          void withTemplate(receipt, (template) => void downloadReceiptDocumentPdf(receipt, template))
        }
        onEdit={openEditForm}
        onDelete={setDeleteTarget}
      />

      <ReceiptFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        members={sheetMembers}
        defaultReceiverName={session?.name ?? ""}
        receipt={editingReceipt}
        onSave={handleSave}
        gyms={gyms}
        selectedGymId={selectedGymId}
        onGymChange={setSelectedGymId}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete receipt?</DialogTitle>
            <DialogDescription>
              This will permanently remove receipt {deleteTarget?.receiptNumber} for{" "}
              {deleteTarget ? gymNameById[deleteTarget.gymId] ?? "this gym" : ""}. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
