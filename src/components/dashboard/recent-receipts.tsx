import { Link } from "react-router-dom"
import { ArrowUpRight, Download, Receipt as ReceiptIcon } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/format"
import type { Receipt } from "@/types"

const STATUS_META: Record<Receipt["status"], { label: string; variant: "success" | "warning" | "destructive" }> = {
  paid: { label: "Paid", variant: "success" },
  partial: { label: "Partially Paid", variant: "warning" },
  pending: { label: "Pending", variant: "destructive" },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

interface RecentReceiptsProps {
  receipts: Receipt[]
  onDownload: (receipt: Receipt) => void
}

export function RecentReceipts({ receipts, onDownload }: RecentReceiptsProps) {
  return (
    <Card className="p-6">
      <CardHeader className="flex-row items-center justify-between p-0">
        <div>
          <CardTitle>Recent receipts</CardTitle>
          <CardDescription>Latest digital receipts generated</CardDescription>
        </div>
        <Link
          to="/gym-owner/receipts"
          className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View all
          <ArrowUpRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="p-0 pt-5">
        {receipts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ReceiptIcon className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No receipts generated yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-3 font-medium">Receipt</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 text-right font-medium">Download</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => {
                  const status = STATUS_META[receipt.status]
                  return (
                    <tr key={receipt.id} className="border-t border-border/60">
                      <td className="py-3">
                        <p className="font-medium text-foreground">{receipt.receiptNumber}</p>
                        <p className="text-xs text-muted-foreground">{receipt.memberName}</p>
                      </td>
                      <td className="py-3 font-medium tabular-nums text-foreground">
                        {formatCurrency(receipt.amountPaid)}
                      </td>
                      <td className="py-3">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">{formatDate(receipt.receiptDate)}</td>
                      <td className="py-3 text-right">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => onDownload(receipt)}>
                          <Download className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
