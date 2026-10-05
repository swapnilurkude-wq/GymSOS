import type { Member } from "@/types"

export type MemberStatus = "active" | "expiring" | "expired" | "pending"

const DAY_MS = 1000 * 60 * 60 * 24

export function getMemberStatus(member: Member): MemberStatus {
  const now = Date.now()
  const end = new Date(member.endDate).getTime()

  if (end < now) return "expired"
  if (member.balanceAmount > 0) return "pending"
  if (end - now <= 7 * DAY_MS) return "expiring"
  return "active"
}

export const MEMBER_STATUS_META: Record<
  MemberStatus,
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  active: { label: "Active", variant: "success" },
  expiring: { label: "Expiring soon", variant: "warning" },
  pending: { label: "Payment pending", variant: "warning" },
  expired: { label: "Expired", variant: "destructive" },
}
