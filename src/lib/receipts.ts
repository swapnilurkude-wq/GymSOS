import { getGymPrefix, nextCounterValue } from "@/lib/counters"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"
import {
  fromReceiptRow,
  toReceiptPatch,
  toReceiptRow,
  type ReceiptRow,
} from "@/lib/supabase-rows"
import { STORAGE_KEYS, readStorage, writeStorage } from "@/lib/storage"
import type {
  Member,
  Receipt,
  ReceiptFormValues,
  ReceiptStatus,
} from "@/types"

export function computeReceiptStatus(totalAmount: number, amountPaid: number): ReceiptStatus {
  const remaining = totalAmount - amountPaid
  if (remaining <= 0) return "paid"
  if (amountPaid > 0) return "partial"
  return "pending"
}

export function computeReceiptBalance(totalAmount: number, amountPaid: number): number {
  return Math.max(0, totalAmount - amountPaid)
}

export async function getAllReceipts(): Promise<Receipt[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().from("receipts").select("*")
    if (error) throw error
    return ((data ?? []) as ReceiptRow[]).map(fromReceiptRow)
  }
  return readStorage<Receipt[]>(STORAGE_KEYS.receipts, [])
}

export async function getReceiptsByGym(gymId: string): Promise<Receipt[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from("receipts")
      .select("*")
      .eq("gym_id", gymId)
    if (error) throw error
    return ((data ?? []) as ReceiptRow[]).map(fromReceiptRow)
  }
  return readStorage<Receipt[]>(STORAGE_KEYS.receipts, []).filter((r) => r.gymId === gymId)
}

export async function getReceiptsByMember(memberId: string): Promise<Receipt[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from("receipts")
      .select("*")
      .eq("member_id", memberId)
    if (error) throw error
    return ((data ?? []) as ReceiptRow[]).map(fromReceiptRow)
  }
  return readStorage<Receipt[]>(STORAGE_KEYS.receipts, []).filter(
    (r) => r.memberId === memberId
  )
}

export async function createReceipt(gymId: string, values: ReceiptFormValues): Promise<Receipt> {
  const now = new Date().toISOString()
  const receipt: Receipt = {
    ...values,
    id: crypto.randomUUID(),
    gymId,
    receiptNumber: `${await getGymPrefix(gymId)}-RCT-${String(
      await nextCounterValue(gymId, "bump_receipt_ledger_counter", STORAGE_KEYS.receiptLedgerCounters)
    ).padStart(4, "0")}`,
    balanceAmount: computeReceiptBalance(values.totalAmount, values.amountPaid),
    status: computeReceiptStatus(values.totalAmount, values.amountPaid),
    createdAt: now,
    updatedAt: now,
  }

  if (isSupabaseConfigured()) {
    const { error } = await getSupabase().from("receipts").insert(toReceiptRow(receipt))
    if (error) throw error
    return receipt
  }

  writeStorage<Receipt[]>(STORAGE_KEYS.receipts, [
    ...readStorage<Receipt[]>(STORAGE_KEYS.receipts, []),
    receipt,
  ])
  return receipt
}

export async function updateReceipt(id: string, values: ReceiptFormValues): Promise<Receipt | null> {
  const balanceAmount = computeReceiptBalance(values.totalAmount, values.amountPaid)
  const status = computeReceiptStatus(values.totalAmount, values.amountPaid)

  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from("receipts")
      .update({
        ...toReceiptPatch(values),
        balance_amount: balanceAmount,
        status,
      })
      .eq("id", id)
      .maybeSingle()
    if (error) throw error
    return data ? fromReceiptRow(data as ReceiptRow) : null
  }

  const all = readStorage<Receipt[]>(STORAGE_KEYS.receipts, [])
  const index = all.findIndex((r) => r.id === id)
  if (index === -1) return null

  const updated: Receipt = {
    ...all[index],
    ...values,
    balanceAmount,
    status,
    updatedAt: new Date().toISOString(),
  }
  const next = [...all]
  next[index] = updated
  writeStorage<Receipt[]>(STORAGE_KEYS.receipts, next)
  return updated
}

export async function deleteReceipt(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabase().from("receipts").delete().eq("id", id)
    if (error) throw error
    return
  }

  writeStorage<Receipt[]>(
    STORAGE_KEYS.receipts,
    readStorage<Receipt[]>(STORAGE_KEYS.receipts, []).filter((r) => r.id !== id)
  )
}

export function receiptValuesFromMember(member: Member): ReceiptFormValues {
  return {
    memberId: member.id,
    receiptDate: member.paymentDate,
    memberName: member.name,
    memberContact: member.contactNumber,
    memberDob: "",
    gender: member.gender,
    particular: member.memberType,
    plan: member.plan,
    durationMonths: member.durationMonths,
    startDate: member.startDate,
    endDate: member.endDate,
    totalAmount: member.amount - member.discount,
    amountPaid: member.paidAmount,
    cashAmount: member.cashAmount,
    onlineAmount: member.onlineAmount,
    balancePaid: 0,
    balanceDueDate: "",
    paymentMode: member.paymentMode,
    transactionId: "",
    notes: member.notes,
    nutrition: false,
    personalTraining: false,
    customerSignature: "",
    receiverSignature: member.paymentReceiver,
  }
}

export async function createReceiptForMember(gymId: string, member: Member): Promise<Receipt> {
  return createReceipt(gymId, receiptValuesFromMember(member))
}
