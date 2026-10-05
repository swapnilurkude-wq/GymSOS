import { memberToFormValues } from "@/lib/member-defaults"
import type { Member, MemberFormValues } from "@/types"

export type CollectionMode = "cash" | "online"

export function isSameDay(iso: string, ref: Date): boolean {
  const d = new Date(iso)
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  )
}

export function isSameMonth(iso: string, ref: Date): boolean {
  const d = new Date(iso)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}

export function isWithinLastDays(iso: string, days: number, ref: Date): boolean {
  const diffMs = ref.getTime() - new Date(iso).getTime()
  return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000
}

export interface PaymentSummary {
  todayCollection: number
  monthCollection: number
  totalOutstanding: number
  totalCollected: number
}

export function computePaymentSummary(members: Member[]): PaymentSummary {
  const now = new Date()
  return members.reduce<PaymentSummary>(
    (acc, m) => ({
      todayCollection: acc.todayCollection + (isSameDay(m.paymentDate, now) ? m.paidAmount : 0),
      monthCollection: acc.monthCollection + (isSameMonth(m.paymentDate, now) ? m.paidAmount : 0),
      totalOutstanding: acc.totalOutstanding + m.balanceAmount,
      totalCollected: acc.totalCollected + m.paidAmount,
    }),
    { todayCollection: 0, monthCollection: 0, totalOutstanding: 0, totalCollected: 0 }
  )
}

export function recordPaymentValues(
  member: Member,
  collectedAmount: number,
  mode: CollectionMode,
  receiver: string
): MemberFormValues {
  const base = memberToFormValues(member)
  const wasMixed = base.paymentMode === "mixed"

  return {
    ...base,
    paidAmount: member.paidAmount + collectedAmount,
    paymentMode: wasMixed ? "mixed" : mode,
    cashAmount: base.cashAmount + (mode === "cash" ? collectedAmount : 0),
    onlineAmount: base.onlineAmount + (mode === "online" ? collectedAmount : 0),
    paymentReceiver: receiver,
    paymentDate: new Date().toISOString(),
  }
}
