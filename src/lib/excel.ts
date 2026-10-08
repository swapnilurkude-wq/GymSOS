import { GENDER_LABEL, PLAN_DURATION_MONTHS } from "@/types"
import type { Member, MemberFormValues, MembershipPlan } from "@/types"

// xlsx is large (~400 kB) and only needed for user-triggered exports and
// imports, so it is loaded on demand instead of entering the initial bundle.

const EXPORT_HEADERS = [
  "Receipt No",
  "Name",
  "Contact",
  "Gender",
  "Address",
  "Type",
  "Plan",
  "Duration (months)",
  "Start Date",
  "End Date",
  "Amount",
  "Discount",
  "Paid Amount",
  "Balance Amount",
  "Payment Mode",
  "Cash Amount",
  "Online Amount",
  "Payment Receiver",
  "Payment Date",
  "Notes",
] as const

function toDateOnly(iso: string): string {
  return iso.slice(0, 10)
}

export async function exportRowsToExcel(
  rows: Record<string, string | number>[],
  filename: string,
  sheetName = "Report"
): Promise<void> {
  const XLSX = await import("xlsx")
  const sheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`)
}

export async function exportMembersToExcel(members: Member[], gymName: string): Promise<void> {
  const XLSX = await import("xlsx")
  const rows = members.map((m) => ({
    "Receipt No": m.receiptNumber,
    Name: m.name,
    Contact: m.contactNumber,
    Gender: GENDER_LABEL[m.gender] ?? m.gender,
    Address: m.address,
    Type: m.memberType === "new" ? "New" : "Renewal",
    Plan: m.plan,
    "Duration (months)": m.durationMonths,
    "Start Date": toDateOnly(m.startDate),
    "End Date": toDateOnly(m.endDate),
    Amount: m.amount,
    Discount: m.discount,
    "Paid Amount": m.paidAmount,
    "Balance Amount": m.balanceAmount,
    "Payment Mode": m.paymentMode,
    "Cash Amount": m.cashAmount,
    "Online Amount": m.onlineAmount,
    "Payment Receiver": m.paymentReceiver,
    "Payment Date": toDateOnly(m.paymentDate),
    Notes: m.notes,
  }))

  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...EXPORT_HEADERS] })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "Members")
  XLSX.writeFile(workbook, `${gymName.replace(/\s+/g, "-")}-members.xlsx`)
}

export async function downloadImportTemplate(): Promise<void> {
  const XLSX = await import("xlsx")
  const sample = [
    {
      Name: "Sample Member",
      Contact: "9800000000",
      Gender: "male",
      Address: "MG Road, Pune",
      Type: "New",
      Plan: "Monthly",
      "Start Date": toDateOnly(new Date().toISOString()),
      Amount: 2500,
      Discount: 0,
      "Paid Amount": 2500,
      "Payment Mode": "cash",
      "Payment Receiver": "Owner",
      "Payment Date": toDateOnly(new Date().toISOString()),
      Notes: "",
    },
  ]
  const sheet = XLSX.utils.json_to_sheet(sample)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "Members")
  XLSX.writeFile(workbook, "gymsos-import-template.xlsx")
}

interface ImportRow {
  Name?: string
  Contact?: string | number
  Gender?: string
  Address?: string
  Type?: string
  Plan?: string
  "Duration (months)"?: number
  "Start Date"?: string
  "End Date"?: string
  Amount?: number
  Discount?: number
  "Paid Amount"?: number
  "Payment Mode"?: string
  "Cash Amount"?: number
  "Online Amount"?: number
  "Payment Receiver"?: string
  "Payment Date"?: string
  Notes?: string
}

const VALID_PLANS = new Set<MembershipPlan>(["Monthly", "Quarterly", "Half-Yearly", "Annual"])

export interface ImportResult {
  rows: MemberFormValues[]
  errors: string[]
}

function parseDate(value: string | undefined, fallback: Date): string {
  if (!value) return fallback.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString()
}

function parseGender(raw: string | undefined): MemberFormValues["gender"] {
  const value = raw?.trim().toLowerCase()
  if (value === "prefer not to say" || value === "undisclosed") {
    return "undisclosed"
  }
  return (value as MemberFormValues["gender"]) || "male"
}

export async function parseMembersFromExcelFile(file: File): Promise<ImportResult> {
  const XLSX = await import("xlsx")
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { rows: [], errors: ["The file has no sheets."] }

  const sheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<ImportRow>(sheet, { defval: "" })

  const rows: MemberFormValues[] = []
  const errors: string[] = []

  rawRows.forEach((raw, index) => {
    const rowLabel = `Row ${index + 2}`
    const name = String(raw.Name ?? "").trim()
    const contactNumber = String(raw.Contact ?? "").trim()
    const amount = Number(raw.Amount ?? 0)

    if (!name || !contactNumber || !amount) {
      errors.push(`${rowLabel}: missing required Name, Contact, or Amount — skipped.`)
      return
    }

    const planRaw = String(raw.Plan ?? "Monthly").trim() as MembershipPlan
    const plan = VALID_PLANS.has(planRaw) ? planRaw : "Monthly"
    const durationMonths = Number(raw["Duration (months)"] ?? PLAN_DURATION_MONTHS[plan])

    const now = new Date()
    const startDate = parseDate(raw["Start Date"], now)
    const defaultEnd = new Date(startDate)
    defaultEnd.setMonth(defaultEnd.getMonth() + durationMonths)
    const endDate = parseDate(raw["End Date"], defaultEnd)

    const discount = Number(raw.Discount ?? 0)
    const paidAmount = Number(raw["Paid Amount"] ?? amount)
    const paymentModeRaw = String(raw["Payment Mode"] ?? "cash").toLowerCase()
    const paymentMode = paymentModeRaw === "online" || paymentModeRaw === "mixed" ? paymentModeRaw : "cash"

    rows.push({
      name,
      contactNumber,
      gender: parseGender(raw.Gender),
      address: String(raw.Address ?? ""),
      memberType: String(raw.Type ?? "New").toLowerCase() === "renewal" ? "renewal" : "new",
      plan,
      durationMonths,
      startDate,
      endDate,
      amount,
      discount,
      paidAmount,
      paymentMode,
      cashAmount: paymentMode === "online" ? 0 : Number(raw["Cash Amount"] ?? paidAmount),
      onlineAmount: paymentMode === "cash" ? 0 : Number(raw["Online Amount"] ?? (paymentMode === "online" ? paidAmount : 0)),
      paymentReceiver: String(raw["Payment Receiver"] ?? ""),
      paymentDate: parseDate(raw["Payment Date"], now),
      notes: String(raw.Notes ?? ""),
      termsAccepted: true,
    })
  })

  return { rows, errors }
}
