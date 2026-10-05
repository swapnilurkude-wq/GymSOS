import { Link } from "react-router-dom"
import { ArrowUpRight } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatCurrency } from "@/lib/format"
import { MEMBER_STATUS_META } from "@/lib/member-status"
import type { RecentMemberRow } from "@/data/dashboard-mock"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

export function RecentMembers({ rows }: { rows: RecentMemberRow[] }) {
  return (
    <Card className="p-6">
      <CardHeader className="flex-row items-center justify-between p-0">
        <div>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Latest registrations, renewals & payments</CardDescription>
        </div>
        <Link
          to="/gym-owner/members"
          className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View all
          <ArrowUpRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="p-0 pt-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-3 font-medium">Member</th>
                <th className="pb-3 font-medium">Plan</th>
                <th className="pb-3 font-medium">Amount</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 text-right font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = MEMBER_STATUS_META[row.status]
                return (
                  <tr key={row.id} className="border-t border-border/60">
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">{row.initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{row.name}</p>
                          <p className="text-xs text-muted-foreground">{row.type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">{row.plan}</td>
                    <td className="py-3 font-medium tabular-nums text-foreground">
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="py-3">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                    <td className="py-3 text-right text-muted-foreground">{formatDate(row.date)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
