import { describe, expect, it } from "vitest"
import {
  computeGymKpiStats,
  computeGymPlanMix,
  computeGymRevenueTrend,
  computeRecentMembers,
  lastNDays,
  pctChange,
} from "@/lib/dashboard-stats"
import { isoDaysFromNow, isoFirstOfPreviousMonth, makeMember } from "@/test/helpers"

describe("pctChange", () => {
  it("computes percentage change between two values", () => {
    expect(pctChange(100, 150)).toBe(50)
    expect(pctChange(200, 100)).toBe(-50)
  })

  it("handles a zero baseline", () => {
    expect(pctChange(0, 0)).toBe(0)
    expect(pctChange(0, 10)).toBe(100)
  })
})

describe("lastNDays", () => {
  it("returns n consecutive days ending at the reference date", () => {
    const now = new Date()
    const days = lastNDays(3, now)

    expect(days).toHaveLength(3)
    expect(days[2].toDateString()).toBe(now.toDateString())
    expect(days[0].toDateString()).toBe(
      new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toDateString()
    )
  })
})

describe("computeGymKpiStats", () => {
  const members = [
    makeMember({
      id: "active",
      name: "Active Member",
      createdAt: isoDaysFromNow(-40),
      updatedAt: isoDaysFromNow(-40),
      paymentDate: new Date().toISOString(),
      paidAmount: 2500,
      cashAmount: 2500,
      endDate: isoDaysFromNow(30),
      balanceAmount: 0,
    }),
    makeMember({
      id: "expiring",
      name: "Expiring Member",
      createdAt: isoDaysFromNow(-40),
      updatedAt: isoDaysFromNow(-40),
      paymentDate: isoFirstOfPreviousMonth(),
      paidAmount: 2500,
      cashAmount: 2500,
      endDate: isoDaysFromNow(3),
      balanceAmount: 0,
    }),
    makeMember({
      id: "pending",
      name: "Pending Member",
      createdAt: isoDaysFromNow(-40),
      updatedAt: isoDaysFromNow(-40),
      paymentDate: isoFirstOfPreviousMonth(),
      amount: 5000,
      paidAmount: 1000,
      cashAmount: 1000,
      balanceAmount: 4000,
      endDate: isoDaysFromNow(60),
      plan: "Quarterly",
      durationMonths: 3,
    }),
    makeMember({
      id: "expired",
      name: "Expired Member",
      createdAt: isoDaysFromNow(-40),
      updatedAt: isoDaysFromNow(-40),
      paymentDate: isoFirstOfPreviousMonth(),
      paidAmount: 2500,
      cashAmount: 2500,
      endDate: isoDaysFromNow(-5),
      balanceAmount: 0,
    }),
    makeMember({
      id: "new",
      name: "New Member",
      createdAt: isoDaysFromNow(-2),
      updatedAt: isoDaysFromNow(-2),
      paymentDate: isoFirstOfPreviousMonth(),
      paidAmount: 1000,
      cashAmount: 1000,
      endDate: isoDaysFromNow(28),
      balanceAmount: 0,
    }),
  ]

  it("computes headline KPIs from the member list", () => {
    const byKey = Object.fromEntries(computeGymKpiStats(members).map((s) => [s.key, s]))

    expect(byKey["total-members"].value).toBe(5)
    expect(byKey["active-members"].value).toBe(2)
    expect(byKey["expiring-members"].value).toBe(1)
    expect(byKey["renewal-due"].value).toBe(3)
    expect(byKey["renewal-due"].context).toBe("1 due within 7 days")
    expect(byKey["pending-payments"].value).toBe(4000)
    expect(byKey["new-signups"].value).toBe(1)
    expect(byKey["today-collection"].value).toBe(2500)
    expect(byKey["monthly-revenue"].value).toBe(2500)
  })

  it("produces 7-day sparklines for daily trends and 8 points for monthly trends", () => {
    const byKey = Object.fromEntries(computeGymKpiStats(members).map((s) => [s.key, s]))

    for (const key of [
      "total-members",
      "active-members",
      "today-collection",
      "new-signups",
      "renewal-due",
      "expiring-members",
    ]) {
      expect(byKey[key].sparkline).toHaveLength(7)
    }
    expect(byKey["monthly-revenue"].sparkline).toHaveLength(8)
  })
})

describe("computeGymRevenueTrend", () => {
  it("returns 8 monthly buckets with the current month's collections", () => {
    const members = [
      makeMember({ paymentDate: new Date().toISOString(), paidAmount: 2500, cashAmount: 2500 }),
      makeMember({ paymentDate: isoFirstOfPreviousMonth(), paidAmount: 1000, cashAmount: 1000 }),
    ]

    const trend = computeGymRevenueTrend(members)
    expect(trend).toHaveLength(8)
    expect(trend[7].revenue).toBe(2500)
    expect(trend[6].revenue).toBe(1000)
  })
})

describe("computeGymPlanMix", () => {
  it("counts members per plan in a stable order", () => {
    const members = [
      makeMember({ id: "m1", plan: "Monthly" }),
      makeMember({ id: "m2", plan: "Monthly" }),
      makeMember({ id: "m3", plan: "Quarterly" }),
    ]

    expect(computeGymPlanMix(members)).toEqual([
      { name: "Monthly", value: 2 },
      { name: "Quarterly", value: 1 },
      { name: "Half-Yearly", value: 0 },
      { name: "Annual", value: 0 },
    ])
  })
})

describe("computeRecentMembers", () => {
  it("sorts by most recently updated and derives initials, type and status", () => {
    const members = [
      makeMember({
        id: "old",
        name: "Rohit Sharma",
        memberType: "renewal",
        plan: "Annual",
        durationMonths: 12,
        updatedAt: isoDaysFromNow(-10),
        endDate: isoDaysFromNow(60),
        balanceAmount: 0,
      }),
      makeMember({
        id: "fresh",
        name: "Ananya Deshpande",
        memberType: "new",
        updatedAt: isoDaysFromNow(-1),
        endDate: isoDaysFromNow(60),
        balanceAmount: 0,
      }),
    ]

    const rows = computeRecentMembers(members)
    expect(rows).toHaveLength(2)
    expect(rows[0].name).toBe("Ananya Deshpande")
    expect(rows[0].initials).toBe("AD")
    expect(rows[0].type).toBe("New")
    expect(rows[0].status).toBe("active")
    expect(rows[1].name).toBe("Rohit Sharma")
    expect(rows[1].initials).toBe("RS")
    expect(rows[1].type).toBe("Renewal")
  })
})
