import { getGymPrefix, nextCounterValue } from "@/lib/counters"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"
import {
  fromMemberRow,
  toMemberPatch,
  toMemberRow,
  type MemberRow,
} from "@/lib/supabase-rows"
import { STORAGE_KEYS, readStorage, writeStorage } from "@/lib/storage"
import type { Member, MemberFormValues, ReceiptFormValues } from "@/types"

export function computeBalance(amount: number, discount: number, paidAmount: number): number {
  return Math.max(0, amount - discount - paidAmount)
}

export async function getAllMembers(): Promise<Member[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().from("members").select("*")
    if (error) throw error
    return ((data ?? []) as MemberRow[]).map(fromMemberRow)
  }
  return readStorage<Member[]>(STORAGE_KEYS.members, [])
}

export async function getMembersByGym(gymId: string): Promise<Member[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from("members")
      .select("*")
      .eq("gym_id", gymId)
    if (error) throw error
    return ((data ?? []) as MemberRow[]).map(fromMemberRow)
  }
  return readStorage<Member[]>(STORAGE_KEYS.members, []).filter((m) => m.gymId === gymId)
}

export async function createMember(gymId: string, values: MemberFormValues): Promise<Member> {
  const now = new Date().toISOString()
  const member: Member = {
    ...values,
    id: crypto.randomUUID(),
    gymId,
    receiptNumber: `${await getGymPrefix(gymId)}-${String(
      await nextCounterValue(gymId, "bump_receipt_counter", STORAGE_KEYS.receiptCounters)
    ).padStart(4, "0")}`,
    balanceAmount: computeBalance(values.amount, values.discount, values.paidAmount),
    createdAt: now,
    updatedAt: now,
  }

  if (isSupabaseConfigured()) {
    const { error } = await getSupabase().from("members").insert(toMemberRow(member))
    if (error) throw error
    return member
  }

  writeStorage<Member[]>(STORAGE_KEYS.members, [
    ...readStorage<Member[]>(STORAGE_KEYS.members, []),
    member,
  ])
  return member
}

export async function updateMember(id: string, values: MemberFormValues): Promise<Member | null> {
  const balanceAmount = computeBalance(values.amount, values.discount, values.paidAmount)

  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from("members")
      .update({ ...toMemberPatch(values), balance_amount: balanceAmount })
      .eq("id", id)
      .maybeSingle()
    if (error) throw error
    return data ? fromMemberRow(data as MemberRow) : null
  }

  const all = readStorage<Member[]>(STORAGE_KEYS.members, [])
  const index = all.findIndex((m) => m.id === id)
  if (index === -1) return null

  const updated: Member = {
    ...all[index],
    ...values,
    balanceAmount,
    updatedAt: new Date().toISOString(),
  }
  const next = [...all]
  next[index] = updated
  writeStorage<Member[]>(STORAGE_KEYS.members, next)
  return updated
}

export async function deleteMember(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabase().from("members").delete().eq("id", id)
    if (error) throw error
    return
  }

  writeStorage<Member[]>(
    STORAGE_KEYS.members,
    readStorage<Member[]>(STORAGE_KEYS.members, []).filter((m) => m.id !== id)
  )
}

export function memberValuesFromReceiptForm(values: ReceiptFormValues): MemberFormValues {
  return {
    photoUrl: undefined,
    name: values.memberName,
    contactNumber: values.memberContact,
    gender: "other",
    address: "",
    memberType: values.particular === "renewal" ? "renewal" : "new",
    plan: values.plan,
    durationMonths: values.durationMonths,
    startDate: values.startDate,
    endDate: values.endDate,
    amount: values.totalAmount,
    discount: 0,
    paidAmount: values.amountPaid,
    paymentMode: values.paymentMode,
    cashAmount: values.cashAmount,
    onlineAmount: values.onlineAmount,
    paymentReceiver: values.receiverSignature,
    paymentDate: values.receiptDate,
    notes: values.notes,
    termsAccepted: true,
  }
}

export async function importMembers(gymId: string, rows: MemberFormValues[]): Promise<Member[]> {
  const now = new Date().toISOString()
  const created: Member[] = []

  for (const values of rows) {
    const member: Member = {
      ...values,
      id: crypto.randomUUID(),
      gymId,
      receiptNumber: `${await getGymPrefix(gymId)}-${String(
        await nextCounterValue(gymId, "bump_receipt_counter", STORAGE_KEYS.receiptCounters)
      ).padStart(4, "0")}`,
      balanceAmount: computeBalance(values.amount, values.discount, values.paidAmount),
      createdAt: now,
      updatedAt: now,
    }
    created.push(member)
  }

  if (isSupabaseConfigured()) {
    const { error } = await getSupabase().from("members").insert(created.map(toMemberRow))
    if (error) throw error
    return created
  }

  writeStorage<Member[]>(STORAGE_KEYS.members, [
    ...readStorage<Member[]>(STORAGE_KEYS.members, []),
    ...created,
  ])
  return created
}
