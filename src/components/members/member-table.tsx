import { MoreHorizontal, Pencil, Printer, FileDown, Trash2, Users, Lock } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { getMemberStatus, MEMBER_STATUS_META } from "@/lib/member-status"
import type { Member } from "@/types"

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

interface MemberTableProps {
  members: Member[]
  onEdit?: (member: Member) => void
  onDelete?: (member: Member) => void
  onPrintReceipt: (member: Member) => void
  onDownloadPdf: (member: Member) => void
  pdfLockedReason?: string
}

export function MemberTable({
  members,
  onEdit,
  onDelete,
  onPrintReceipt,
  onDownloadPdf,
  pdfLockedReason,
}: MemberTableProps) {
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Users className="size-6" />
        </div>
        <p className="font-display text-base font-semibold text-foreground">No members found</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Try adjusting your search or filters, or add a new member to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-premium">
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
            <th className="px-5 py-3 font-medium">Member</th>
            <th className="px-5 py-3 font-medium">Plan</th>
            <th className="px-5 py-3 font-medium">Membership</th>
            <th className="px-5 py-3 font-medium">Amount</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const status = getMemberStatus(member)
            const statusMeta = MEMBER_STATUS_META[status]

            return (
              <tr key={member.id} className="border-b border-border/40 last:border-0 hover:bg-secondary/30">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9">
                      <AvatarImage src={member.photoUrl} alt={member.name} />
                      <AvatarFallback className="text-xs">{initialsOf(member.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.contactNumber} · {member.receiptNumber}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <p className="text-foreground">{member.plan}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.memberType === "new" ? "New" : "Renewal"}
                  </p>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">
                  <p>{formatDate(member.startDate)}</p>
                  <p className="text-xs">to {formatDate(member.endDate)}</p>
                </td>
                <td className="px-5 py-3.5 tabular-nums">
                  <p className="font-medium text-foreground">{formatCurrency(member.paidAmount)}</p>
                  {member.balanceAmount > 0 && (
                    <p className="text-xs text-warning">Bal. {formatCurrency(member.balanceAmount)}</p>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onEdit && (
                        <DropdownMenuItem onClick={() => onEdit(member)}>
                          <Pencil /> Edit member
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onPrintReceipt(member)}>
                        <Printer /> Print receipt
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!!pdfLockedReason}
                        title={pdfLockedReason}
                        onClick={() => onDownloadPdf(member)}
                      >
                        {pdfLockedReason ? <Lock /> : <FileDown />} Download PDF
                      </DropdownMenuItem>
                      {onDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => onDelete(member)}>
                            <Trash2 /> Delete member
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
