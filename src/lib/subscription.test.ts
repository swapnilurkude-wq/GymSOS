import { describe, expect, it } from "vitest"
import { changePlanValues, renewSubscriptionValues, toggleSuspendValues } from "@/lib/subscription"
import { isoDaysFromNow, makeGym } from "@/test/helpers"

describe("renewSubscriptionValues", () => {
  it("uses the manually chosen renewal date and reactivates the gym", () => {
    const gym = makeGym({
      subscriptionEndDate: isoDaysFromNow(-10),
      status: "expired",
    })
    const chosenDate = isoDaysFromNow(60)
    const next = renewSubscriptionValues(gym, chosenDate)

    expect(next.subscriptionEndDate).toBe(chosenDate)
    expect(next.status).toBe("active")
    expect(next.name).toBe(gym.name)
  })

  it("leaves every other gym field untouched", () => {
    const gym = makeGym({ subscriptionEndDate: isoDaysFromNow(90) })
    const chosenDate = isoDaysFromNow(120)
    const next = renewSubscriptionValues(gym, chosenDate)

    expect(next.subscriptionEndDate).toBe(chosenDate)
    expect(next.location).toBe(gym.location)
    expect(next.ownerEmail).toBe(gym.ownerEmail)
    expect(next.memberCount).toBe(gym.memberCount)
    expect(next.plan).toBe(gym.plan)
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
