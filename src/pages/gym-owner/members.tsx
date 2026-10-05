import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { AlertCircle, CalendarClock, CheckCircle2, X } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useMembers } from "@/hooks/use-members"
import { useGymPlan } from "@/hooks/use-gym-plan"
import { DataErrorBanner } from "@/components/shared/data-error-banner"
import { StatCard } from "@/components/shared/stat-card"
import { MemberToolbar, type MemberFilters } from "@/components/members/member-toolbar"
import { MemberTable } from "@/components/members/member-table"
import { ReceiptFormSheet } from "@/components/receipts/receipt-form-sheet"
import { getMemberStatus } from "@/lib/member-status"
import { printReceipt, downloadReceiptPdf } from "@/lib/receipt"
import { createReceipt, createReceiptForMember } from "@/lib/receipts"
import { memberValuesFromReceiptForm } from "@/lib/members"
import { exportMembersToExcel, parseMembersFromExcelFile, downloadImportTemplate } from "@/lib/excel"
import type { Member, ReceiptFormValues } from "@/types"

const DEFAULT_FILTERS: MemberFilters = { search: "", status: "all", plan: "all", type: "all" }

export default function MembersPage() {
  const { session } = useAuth()
  const gymId = session?.gymId ?? ""
  const gymName = session?.gymName ?? "Your Gym"
  const { members, error: membersError, refresh: refreshMembers, addMember, importMembers } = useMembers(gymId)
  const { planLabel, features } = useGymPlan()

  const remainingSlots = features.maxMembers === null ? Infinity : Math.max(0, features.maxMembers - members.length)
  const addMemberLockedReason =
    remainingSlots <= 0
      ? `You've reached the ${features.maxMembers}-member limit on the ${planLabel} plan. Upgrade to add more members.`
      : undefined
  const importLockedReason = !features.excelImport
    ? `Excel import isn't available on the ${planLabel} plan. Upgrade to Growth or higher.`
    : undefined
  const exportLockedReason = !features.excelExport
    ? `Excel export isn't available on the ${planLabel} plan. Upgrade to Starter or higher.`
    : undefined
  const pdfLockedReason = !features.pdfReceipts
    ? `PDF receipts aren't available on the ${planLabel} plan. Upgrade to Starter or higher.`
    : undefined

  const [filters, setFilters] = useState<MemberFilters>(DEFAULT_FILTERS)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const filteredMembers = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    return members.filter((m) => {
      if (query) {
        const haystack = `${m.name} ${m.contactNumber} ${m.receiptNumber}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      if (filters.status !== "all" && getMemberStatus(m) !== filters.status) return false
      if (filters.plan !== "all" && m.plan !== filters.plan) return false
      if (filters.type !== "all" && m.memberType !== filters.type) return false
      return true
    })
  }, [members, filters])

  const pendingRenewals = useMemo(
    () => members.filter((m) => getMemberStatus(m) === "expiring").length,
    [members]
  )

  function openAddForm() {
    if (addMemberLockedReason) {
      setBanner({ type: "error", text: addMemberLockedReason })
      return
    }
    setSheetOpen(true)
  }

  async function handleSave(values: ReceiptFormValues) {
    try {
      const created = await addMember(memberValuesFromReceiptForm(values))
      await createReceipt(gymId, { ...values, memberId: created.id })
      setBanner({
        type: "success",
        text: `${values.memberName} was added successfully. A payment slip was generated automatically.`,
      })
      setSheetOpen(false)
    } catch {
      setBanner({ type: "error", text: "Couldn't add the member. Please try again." })
    }
  }

  function handleExport() {
    if (exportLockedReason) {
      setBanner({ type: "error", text: exportLockedReason })
      return
    }
    void exportMembersToExcel(members, gymName)
  }

  async function handleImportFile(file: File) {
    if (importLockedReason) {
      setBanner({ type: "error", text: importLockedReason })
      return
    }

    const { rows, errors } = await parseMembersFromExcelFile(file)
    const allowedRows = remainingSlots === Infinity ? rows : rows.slice(0, remainingSlots)
    const skippedForLimit = rows.length - allowedRows.length

    if (allowedRows.length > 0) {
      try {
        const created = await importMembers(allowedRows)
        for (const member of created) {
          await createReceiptForMember(gymId, member)
        }
      } catch {
        setBanner({ type: "error", text: "Import failed — please try again." })
        return
      }
    }

    const parts: string[] = []
    if (allowedRows.length > 0) parts.push(`Imported ${allowedRows.length} member(s).`)
    if (errors.length > 0) parts.push(`${errors.length} row(s) were skipped due to errors.`)
    if (skippedForLimit > 0) {
      parts.push(`${skippedForLimit} row(s) were skipped — ${planLabel} plan limit reached.`)
    }
    if (parts.length === 0) parts.push(`Import failed — ${errors[0] ?? "no valid rows found"}.`)

    setBanner({ type: allowedRows.length > 0 ? "success" : "error", text: parts.join(" ") })
  }

  function handlePrintReceipt(member: Member) {
    printReceipt(member, gymName)
  }

  function handleDownloadPdf(member: Member) {
    if (pdfLockedReason) {
      setBanner({ type: "error", text: pdfLockedReason })
      return
    }
    void downloadReceiptPdf(member, gymName)
  }

  return (
    <div className="flex flex-col gap-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1"
      >
        <h1 className="font-display text-xl font-semibold text-foreground">Member Management</h1>
        <p className="text-sm text-muted-foreground">
          {members.length}
          {features.maxMembers !== null && ` of ${features.maxMembers}`} total members at {gymName}
          {features.maxMembers !== null && ` · ${planLabel} plan`}
        </p>
      </motion.div>

      <DataErrorBanner error={membersError} onRetry={refreshMembers} />

      <div className="grid grid-cols-1 gap-4 sm:max-w-xs">
        <StatCard icon={CalendarClock} label="Pending Renewals" value={pendingRenewals} tone="warning" />
      </div>

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
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
            )}
            {banner.text}
          </div>
          <button onClick={() => setBanner(null)} aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      )}

      <MemberToolbar
        filters={filters}
        onFiltersChange={setFilters}
        onAddMember={openAddForm}
        onExport={handleExport}
        onImportFile={handleImportFile}
        onDownloadTemplate={downloadImportTemplate}
        addMemberLockedReason={addMemberLockedReason}
        importLockedReason={importLockedReason}
        exportLockedReason={exportLockedReason}
      />

      <MemberTable
        members={filteredMembers}
        onPrintReceipt={handlePrintReceipt}
        onDownloadPdf={handleDownloadPdf}
        pdfLockedReason={pdfLockedReason}
      />

      <ReceiptFormSheet
        variant="member"
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        members={members}
        defaultReceiverName={session?.name ?? ""}
        onSave={handleSave}
      />
    </div>
  )
}
