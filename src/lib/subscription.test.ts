import { describe, expect, it } from "vitest"
import { changePlanValues, renewSubscriptionValues, toggleSuspendValues } from "@/lib/subscription"
import { isoDaysFromNow, makeGym } from "@/test/helpers"

const DAY_MS = 24 * 60 * 60 * 1000

describe("renewSubscriptionValues", () => {
  it("extends an expired subscription starting today", () => {
    const gym = makeGym({ subscriptionEndDate: isoDaysFromNow(-10) })
    const next = renewSubscriptionValues(gym)

    const end = new Date(next.subscriptionEndDate).getTime()
    const deltaDays = (end - Date.now()) / DAY_MS
    expect(deltaDays).toBeGreaterThan(25)
    expect(deltaDays).toBeLessThan(35)
    expect(next.status).toBe("active")
    expect(next.name).toBe(gym.name)
  })

  it("extends an active subscription from its current end date", () => {
    const gym = makeGym({ subscriptionEndDate: isoDaysFromNow(90) })
    const next = renewSubscriptionValues(gym)

    const end = new Date(next.subscriptionEndDate).getTime()
    const deltaDays = (end - Date.now()) / DAY_MS
    expect(deltaDays).toBeGreaterThan(115)
    expect(deltaDays).toBeLessThan(125)
  })
})

describe("changePlanValues", () => {
  it("switches the plan while keeping the rest of the gym", () => {
    const gym = makeGym({ plan: "starter" })
    const next = changePlanValues(gym, "pro")

    expect(next.plan).toBe("pro")
    expect(next.name).toBe(gym.name)
    expect(next.subscriptionEndDate).toBe(gym.subscriptionEndDate)
  })
})

describe("toggleSuspendValues", () => {
  it("suspends an active gym and reactivates a suspended one", () => {
    expect(toggleSuspendValues(makeGym({ status: "active" })).status).toBe("suspended")
    expect(toggleSuspendValues(makeGym({ status: "suspended" })).status).toBe("active")
  })
})
