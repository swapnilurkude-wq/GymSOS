import { describe, expect, it } from "vitest"
import { computeRevenueBreakdown, computeRevenueSummary, isPaying } from "@/lib/revenue"
import { isoDaysFromNow, makeGym } from "@/test/helpers"

describe("isPaying", () => {
  it("treats active and renewal-due gyms as paying", () => {
    expect(isPaying(makeGym({ subscriptionEndDate: isoDaysFromNow(30) }))).toBe(true)
    expect(isPaying(makeGym({ subscriptionEndDate: isoDaysFromNow(5) }))).toBe(true)
  })

  it("treats expired and suspended gyms as not paying", () => {
    expect(isPaying(makeGym({ subscriptionEndDate: isoDaysFromNow(-5) }))).toBe(false)
    expect(
      isPaying(makeGym({ status: "suspended", subscriptionEndDate: isoDaysFromNow(30) }))
    ).toBe(false)
  })
})

describe("computeRevenueSummary", () => {
  it("sums MRR across paying gyms only", () => {
    const gyms = [
      makeGym({ plan: "pro", subscriptionEndDate: isoDaysFromNow(30) }), // 3499
      makeGym({ id: "g2", plan: "growth", subscriptionEndDate: isoDaysFromNow(5) }), // 1699
      makeGym({ id: "g3", plan: "trial", subscriptionEndDate: isoDaysFromNow(30) }), // 0
      makeGym({ id: "g4", plan: "starter", subscriptionEndDate: isoDaysFromNow(-5) }), // expired
      makeGym({
        id: "g5",
        plan: "pro",
        status: "suspended",
        subscriptionEndDate: isoDaysFromNow(30),
      }), // suspended
    ]

    const summary = computeRevenueSummary(gyms)
    expect(summary.mrr).toBe(3499 + 1699)
    expect(summary.arr).toBe((3499 + 1699) * 12)
    expect(summary.payingGymCount).toBe(3)
    expect(summary.avgPerGym).toBeCloseTo((3499 + 1699) / 3)
  })

  it("returns zeros when nothing is paying", () => {
    expect(computeRevenueSummary([])).toEqual({
      mrr: 0,
      arr: 0,
      payingGymCount: 0,
      avgPerGym: 0,
    })
  })
})

describe("computeRevenueBreakdown", () => {
  it("groups paying gyms by plan", () => {
    const gyms = [
      makeGym({ id: "g1", plan: "pro", subscriptionEndDate: isoDaysFromNow(30) }),
      makeGym({ id: "g2", plan: "pro", subscriptionEndDate: isoDaysFromNow(30) }),
      makeGym({ id: "g3", plan: "starter", subscriptionEndDate: isoDaysFromNow(30) }),
      makeGym({ id: "g4", plan: "growth", subscriptionEndDate: isoDaysFromNow(-2) }), // expired
    ]

    const byPlan = Object.fromEntries(computeRevenueBreakdown(gyms).map((r) => [r.plan, r]))
    expect(byPlan.pro).toEqual({ plan: "pro", label: "Pro", gymCount: 2, revenue: 6998 })
    expect(byPlan.starter).toEqual({
      plan: "starter",
      label: "Starter",
      gymCount: 1,
      revenue: 799,
    })
    expect(byPlan.growth.gymCount).toBe(0)
    expect(byPlan.growth.revenue).toBe(0)
    expect(byPlan.trial.revenue).toBe(0)
  })
})
