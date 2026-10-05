import { MoreHorizontal, Pencil, Printer, FileDown, Trash2, Receipt as ReceiptIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatCurrency } from "@/lib/format"
import { RECEIPT_PARTICULAR_LABEL } from "@/types"
import type { Receipt } from "@/types"

const STATUS_META: Record<Receipt["status"], { label: string; variant: "success" | "warning" | "destructive" }> = {
  paid: { label: "Paid", variant: "success" },
  partial: { label: "Partially Paid", variant: "warning" },
  pending: { label: "Pending", variant: "destructive" },
}

const MODE_LABEL: Record<Receipt["paymentMode"], string> = {
  cash: "Cash",
  online: "Online",
  mixed: "Mixed",
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

interface ReceiptTableProps {
  receipts: Receipt[]
  onPrint: (receipt: Receipt) => void
  onDownload: (receipt: Receipt) => void
  onEdit?: (receipt: Receipt) => void
  onDelete?: (receipt: Receipt) => void
  gymNameById?: Record<string, string>
}

export function ReceiptTable({ receipts, onPrint, onDownload, onEdit, onDelete, gymNameById }: ReceiptTableProps) {
  if (receipts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ReceiptIcon className="size-6" />
        </div>
        <p className="font-display text-base font-semibold text-foreground">No receipts found</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Try adjusting your search or filters, or generate a new receipt to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-premium">
      <table className="w-full min-w-[920px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
            <th className="px-5 py-3 font-medium">Receipt</th>
            <th className="px-5 py-3 font-medium">Member</th>
            {gymNameById && <th className="px-5 py-3 font-medium">Gym</th>}
            <th className="px-5 py-3 font-medium">Particular</th>
            <th className="px-5 py-3 font-medium">Amount</th>
            <th className="px-5 py-3 font-medium">Mode</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Date</th>
            <th className="px-5 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((receipt) => {
            const status = STATUS_META[receipt.status]
            return (
              <tr key={receipt.id} className="border-b border-border/40 last:border-0 hover:bg-secondary/30">
                <td className="px-5 py-3.5 font-medium text-foreground">{receipt.receiptNumber}</td>
                <td className="px-5 py-3.5">
                  <p className="text-foreground">{receipt.memberName}</p>
                  <p className="text-xs text-muted-foreground">{receipt.memberContact}</p>
                </td>
                {gymNameById && (
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {gymNameById[receipt.gymId] ?? "—"}
                  </td>
                )}
                <td className="px-5 py-3.5 text-muted-foreground">
                  {RECEIPT_PARTICULAR_LABEL[receipt.particular]}
                </td>
                <td className="px-5 py-3.5 tabular-nums">
                  <p className="font-medium text-foreground">{formatCurrency(receipt.amountPaid)}</p>
                  {receipt.balanceAmount > 0 && (
                    <p className="text-xs text-warning">Bal. {formatCurrency(receipt.balanceAmount)}</p>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <Badge variant="secondary">{MODE_LABEL[receipt.paymentMode]}</Badge>
                </td>
                <td className="px-5 py-3.5">
                  <Badge variant={status.variant}>{status.label}</Badge>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{formatDate(receipt.receiptDate)}</td>
                <td className="px-5 py-3.5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onEdit && (
                        <DropdownMenuItem onClick={() => onEdit(receipt)}>
                          <Pencil /> Edit receipt
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onPrint(receipt)}>
                        <Printer /> Print receipt
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDownload(receipt)}>
                        <FileDown /> Download PDF
                      </DropdownMenuItem>
                      {onDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => onDelete(receipt)}>
                            <Trash2 /> Delete receipt
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
