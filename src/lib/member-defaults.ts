import type { Member, MemberFormValues } from "@/types"

export function memberToFormValues(member: Member): MemberFormValues {
  return {
    photoUrl: member.photoUrl,
    name: member.name,
    contactNumber: member.contactNumber,
    gender: member.gender,
    address: member.address,
    memberType: member.memberType,
    plan: member.plan,
    durationMonths: member.durationMonths,
    startDate: member.startDate,
    endDate: member.endDate,
    amount: member.amount,
    discount: member.discount,
    paidAmount: member.paidAmount,
    paymentMode: member.paymentMode,
    cashAmount: member.cashAmount,
    onlineAmount: member.onlineAmount,
    paymentReceiver: member.paymentReceiver,
    paymentDate: member.paymentDate,
    notes: member.notes,
    termsAccepted: member.termsAccepted,
  }
}
