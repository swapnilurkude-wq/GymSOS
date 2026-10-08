import { PLAN_DURATION_MONTHS } from "@/types"
import type { Receipt, ReceiptFormValues } from "@/types"

function todayIso(): string {
  return new Date().toISOString()
}

function addMonths(iso: string, months: number): string {
  const date = new Date(iso)
  date.setMonth(date.getMonth() + months)
  return date.toISOString()
}

export function blankReceiptValues(): ReceiptFormValues {
  const today = todayIso()
  return {
    memberId: "",
    receiptDate: today,
    memberName: "",
    memberContact: "",
    memberDob: "",
    gender: "other",
    particular: "new",
    plan: "Monthly",
    durationMonths: PLAN_DURATION_MONTHS.Monthly,
    startDate: today,
    endDate: addMonths(today, PLAN_DURATION_MONTHS.Monthly),
    totalAmount: 0,
    amountPaid: 0,
    cashAmount: 0,
    onlineAmount: 0,
    balancePaid: 0,
    balanceDueDate: "",
    paymentMode: "cash",
    transactionId: "",
    notes: "",
    nutrition: false,
    personalTraining: false,
    customerSignature: "",
    receiverSignature: "",
  }
}

export function receiptToFormValues(receipt: Receipt): ReceiptFormValues {
  return {
    memberId: receipt.memberId,
    receiptDate: receipt.receiptDate,
    memberName: receipt.memberName,
    memberContact: receipt.memberContact,
    memberDob: receipt.memberDob,
    gender: "other",
    particular: receipt.particular,
    plan: receipt.plan,
    durationMonths: receipt.durationMonths,
    startDate: receipt.startDate,
    endDate: receipt.endDate,
    totalAmount: receipt.totalAmount,
    amountPaid: receipt.amountPaid,
    cashAmount: receipt.cashAmount,
    onlineAmount: receipt.onlineAmount,
    balancePaid: receipt.balancePaid,
    balanceDueDate: receipt.balanceDueDate,
    paymentMode: receipt.paymentMode,
    transactionId: receipt.transactionId,
    notes: receipt.notes,
    nutrition: receipt.nutrition,
    personalTraining: receipt.personalTraining,
    customerSignature: receipt.customerSignature,
    receiverSignature: receipt.receiverSignature,
  }
}

export { addMonths }
