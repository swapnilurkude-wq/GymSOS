import { Wallet } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/format"
import type { Member } from "@/types"

const MODE_LABEL: Record<Member["paymentMode"], string> = {
  cash: "Cash",
  online: "Online",
  mixed: "Mixed",
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

interface PaymentTableProps {
  members: Member[]
  onCollect: (member: Member) => void
}

export function PaymentTable({ members, onCollect }: PaymentTableProps) {
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Wallet className="size-6" />
        </div>
        <p className="font-display text-base font-semibold text-foreground">No payments found</p>
        <p className="max-w-sm text-sm text-muted-foreground">Try adjusting your search or filters.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-premium">
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
            <th className="px-5 py-3 font-medium">Member</th>
            <th className="px-5 py-3 font-medium">Amount paid</th>
            <th className="px-5 py-3 font-medium">Mode</th>
            <th className="px-5 py-3 font-medium">Received by</th>
            <th className="px-5 py-3 font-medium">Date</th>
            <th className="px-5 py-3 font-medium">Balance</th>
            <th className="px-5 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="border-b border-border/40 last:border-0 hover:bg-secondary/30">
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <Avatar className="size-8">
                    <AvatarImage src={member.photoUrl} alt={member.name} />
                    <AvatarFallback className="text-xs">{initialsOf(member.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.receiptNumber}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3.5 tabular-nums font-medium text-foreground">
                {formatCurrency(member.paidAmount)}
              </td>
              <td className="px-5 py-3.5">
                <Badge variant="secondary">{MODE_LABEL[member.paymentMode]}</Badge>
              </td>
              <td className="px-5 py-3.5 text-muted-foreground">{member.paymentReceiver}</td>
              <td className="px-5 py-3.5 text-muted-foreground">{formatDate(member.paymentDate)}</td>
              <td className="px-5 py-3.5 tabular-nums">
                {member.balanceAmount > 0 ? (
                  <span className="text-warning">{formatCurrency(member.balanceAmount)}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-5 py-3.5 text-right">
                {member.balanceAmount > 0 && (
                  <Button variant="outline" size="sm" onClick={() => onCollect(member)}>
                    Collect
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
