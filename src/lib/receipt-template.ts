import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"
import {
  fromReceiptTemplateRow,
  toReceiptTemplateRow,
  type ReceiptTemplateRow,
} from "@/lib/supabase-rows"
import { STORAGE_KEYS, readStorage, writeStorage } from "@/lib/storage"
import type { ReceiptTemplate, ReceiptTemplateValues } from "@/types"

export async function getAllReceiptTemplates(): Promise<ReceiptTemplate[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from("receipt_templates")
      .select("*")
    if (error) throw error
    return ((data ?? []) as ReceiptTemplateRow[]).map(fromReceiptTemplateRow)
  }
  return readStorage<ReceiptTemplate[]>(STORAGE_KEYS.receiptTemplates, [])
}

export async function getReceiptTemplate(gymId: string): Promise<ReceiptTemplate | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from("receipt_templates")
      .select("*")
      .eq("gym_id", gymId)
      .maybeSingle()
    if (error) throw error
    return data ? fromReceiptTemplateRow(data as ReceiptTemplateRow) : null
  }
  return (
    readStorage<ReceiptTemplate[]>(STORAGE_KEYS.receiptTemplates, []).find(
      (t) => t.gymId === gymId
    ) ?? null
  )
}

export async function upsertReceiptTemplate(
  gymId: string,
  values: ReceiptTemplateValues
): Promise<ReceiptTemplate> {
  const now = new Date().toISOString()

  if (isSupabaseConfigured()) {
    const existing = await getReceiptTemplate(gymId)
    const template: ReceiptTemplate = {
      ...values,
      gymId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    const { error } = await getSupabase()
      .from("receipt_templates")
      .upsert(toReceiptTemplateRow(template))
    if (error) throw error
    return template
  }

  const all = readStorage<ReceiptTemplate[]>(STORAGE_KEYS.receiptTemplates, [])
  const index = all.findIndex((t) => t.gymId === gymId)

  const template: ReceiptTemplate = {
    ...values,
    gymId,
    createdAt: index >= 0 ? all[index].createdAt : now,
    updatedAt: now,
  }

  const next = [...all]
  if (index >= 0) next[index] = template
  else next.push(template)
  writeStorage<ReceiptTemplate[]>(STORAGE_KEYS.receiptTemplates, next)
  return template
}
