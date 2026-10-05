import { describe, expect, it } from "vitest"
import {
  fromGymRow,
  fromMemberRow,
  fromReceiptRow,
  fromReceiptTemplateRow,
  toGymRow,
  toMemberRow,
  toReceiptRow,
  toReceiptTemplateRow,
} from "@/lib/supabase-rows"
import { makeGym, makeMember } from "@/test/helpers"
import type { Receipt, ReceiptTemplate } from "@/types"

describe("supabase row mappers", () => {
  it("round-trips a gym through snake_case", () => {
    const gym = makeGym()
    expect(fromGymRow(toGymRow(gym))).toEqual(gym)
  })

  it("round-trips a member through snake_case", () => {
    const member = makeMember()
    expect(fromMemberRow(toMemberRow(member))).toEqual(member)
  })

  it("round-trips a receipt template through snake_case", () => {
    const template: ReceiptTemplate = {
      gymId: "gym-1",
      gymName: "Iron Pulse Fitness",
      gymAddress: "Baner Road, Pune",
      contactNumber: "9822099001",
      termsAndConditions: "Fees are non-refundable.",
      authorizedSignatureName: "Rahul Deshmukh",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    }
    expect(fromReceiptTemplateRow(toReceiptTemplateRow(template))).toEqual(template)
  })

  it("round-trips a receipt, trimming datetimes to dates", () => {
    const receipt: Receipt = {
      id: "receipt-1",
      gymId: "gym-1",
      memberId: "member-1",
      receiptNumber: "IPF-RCT-0001",
      receiptDate: "2026-01-05T09:30:00.000Z",
      status: "partial",
      memberName: "Priya Kulkarni",
      memberContact: "9822011234",
      // Full ISO datetime on the app side; the `date` column
      // keeps only the day.
      memberDob: "1995-06-15T00:00:00.000Z",
      particular: "new",
      plan: "Monthly",
      durationMonths: 1,
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-02-01T00:00:00.000Z",
      totalAmount: 3000,
      amountPaid: 2000,
      cashAmount: 1000,
      onlineAmount: 1000,
      balanceAmount: 1000,
      balancePaid: 500,
      balanceDueDate: "2026-01-10T00:00:00.000Z",
      paymentMode: "mixed",
      transactionId: "TXN-1",
      notes: "Follow up",
      nutrition: true,
      personalTraining: false,
      customerSignature: "Priya Kulkarni",
      receiverSignature: "Rahul Deshmukh",
      createdAt: "2026-01-05T09:30:00.000Z",
      updatedAt: "2026-01-05T09:30:00.000Z",
    }

    const row = toReceiptRow(receipt)
    expect(row.member_dob).toBe("1995-06-15")
    expect(row.balance_due_date).toBe("2026-01-10T00:00:00.000Z")

    const back = fromReceiptRow(row)
    expect(back.memberDob).toBe("1995-06-15")
    expect(back.balanceDueDate).toBe("2026-01-10T00:00:00.000Z")
    expect(back.status).toBe("partial")
    expect(back.paymentMode).toBe("mixed")
    expect(back.nutrition).toBe(true)
    expect(back.personalTraining).toBe(false)
  })

  it("maps empty strings to null and back for optional columns", () => {
    const member = makeMember({
      photoUrl: undefined,
      notes: "",
    })
    const row = toMemberRow(member)
    expect(row.photo_url).toBeNull()

    const back = fromMemberRow(row)
    expect(back.photoUrl).toBeUndefined()

    const receipt = {
      ...receiptFixture(),
      memberDob: "",
      balanceDueDate: "",
    }
    const receiptRow = toReceiptRow(receipt)
    expect(receiptRow.member_dob).toBeNull()
    expect(receiptRow.balance_due_date).toBeNull()
    expect(fromReceiptRow(receiptRow).memberDob).toBe("")
    expect(fromReceiptRow(receiptRow).balanceDueDate).toBe("")
  })

  it("keeps an optional logo URL through the template mapper", () => {
    const withLogo: ReceiptTemplate = {
      ...templateFixture(),
      logoUrl: "data:image/png;base64,AAA",
    }
    const row = toReceiptTemplateRow(withLogo)
    expect(row.logo_url).toBe("data:image/png;base64,AAA")
    expect(fromReceiptTemplateRow(row).logoUrl).toBe("data:image/png;base64,AAA")

    const withoutLogo = toReceiptTemplateRow(templateFixture())
    expect(withoutLogo.logo_url).toBeNull()
    expect(fromReceiptTemplateRow(withoutLogo).logoUrl).toBeUndefined()
  })
})

function receiptFixture(): Receipt {
  return {
    id: "receipt-1",
    gymId: "gym-1",
    memberId: "member-1",
    receiptNumber: "IPF-RCT-0001",
    receiptDate: "2026-01-05T09:30:00.000Z",
    status: "paid",
    memberName: "Priya Kulkarni",
    memberContact: "9822011234",
    memberDob: "",
    particular: "renewal",
    plan: "Monthly",
    durationMonths: 1,
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-02-01T00:00:00.000Z",
    totalAmount: 3000,
    amountPaid: 3000,
    cashAmount: 3000,
    onlineAmount: 0,
    balanceAmount: 0,
    balancePaid: 0,
    balanceDueDate: "",
    paymentMode: "cash",
    transactionId: "",
    notes: "",
    nutrition: false,
    personalTraining: false,
    customerSignature: "",
    receiverSignature: "Rahul Deshmukh",
    createdAt: "2026-01-05T09:30:00.000Z",
    updatedAt: "2026-01-05T09:30:00.000Z",
  }
}

function templateFixture(): ReceiptTemplate {
  return {
    gymId: "gym-1",
    gymName: "Iron Pulse Fitness",
    gymAddress: "Baner Road, Pune",
    contactNumber: "9822099001",
    termsAndConditions: "Fees are non-refundable.",
    authorizedSignatureName: "Rahul Deshmukh",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  }
}
