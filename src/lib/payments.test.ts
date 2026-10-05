import { describe, expect, it } from "vitest"
import { isSameDay, isSameMonth, recordPaymentValues } from "@/lib/payments"
import { isoDaysFromNow, makeMember } from "@/test/helpers"

describe("isSameDay", () => {
  it("matches the same calendar day", () => {
    const now = new Date()
    expect(isSameDay(now.toISOString(), now)).toBe(true)
    expect(isSameDay(isoDaysFromNow(-1), now)).toBe(false)
  })
})

describe("isSameMonth", () => {
  it("matches the same calendar month", () => {
    const now = new Date()
    expect(isSameMonth(now.toISOString(), now)).toBe(true)

    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15)
    expect(isSameMonth(prevMonth.toISOString(), now)).toBe(false)
  })
})

describe("recordPaymentValues", () => {
  it("adds a cash collection to a cash-paying member", () => {
    const member = makeMember({
      paymentMode: "cash",
      cashAmount: 2000,
      onlineAmount: 0,
      paidAmount: 2000,
    })

    const next = recordPaymentValues(member, 500, "cash", "Rahul Deshmukh")
    expect(next.paidAmount).toBe(2500)
    expect(next.cashAmount).toBe(2500)
    expect(next.onlineAmount).toBe(0)
    expect(next.paymentMode).toBe("cash")
    expect(next.paymentReceiver).toBe("Rahul Deshmukh")
  })

  it("records online collections separately", () => {
    const member = makeMember({
      paymentMode: "online",
      cashAmount: 0,
      onlineAmount: 2000,
      paidAmount: 2000,
    })

    const next = recordPaymentValues(member, 500, "online", "Rahul Deshmukh")
    expect(next.paidAmount).toBe(2500)
    expect(next.onlineAmount).toBe(2500)
    expect(next.cashAmount).toBe(0)
    expect(next.paymentMode).toBe("online")
  })

  it("keeps mixed mode when the member already paid via both modes", () => {
    const member = makeMember({
      paymentMode: "mixed",
      cashAmount: 1000,
      onlineAmount: 1000,
      paidAmount: 2000,
    })

    const next = recordPaymentValues(member, 500, "online", "Rahul Deshmukh")
    expect(next.paymentMode).toBe("mixed")
    expect(next.onlineAmount).toBe(1500)
    expect(next.cashAmount).toBe(1000)
  })

  it("refreshes the payment date to today", () => {
    const member = makeMember({ paymentDate: isoDaysFromNow(-10) })
    const next = recordPaymentValues(member, 100, "cash", "Rahul Deshmukh")
    expect(isSameDay(next.paymentDate, new Date())).toBe(true)
  })
})
