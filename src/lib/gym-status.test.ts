import { describe, expect, it } from "vitest"
import { getGymStatus, getTrialState, trialDaysRemaining } from "@/lib/gym-status"
import { isoDaysFromNow, makeGym } from "@/test/helpers"

describe("getGymStatus", () => {
  it("reports suspended gyms as suspended regardless of dates", () => {
    const gym = makeGym({ status: "suspended", subscriptionEndDate: isoDaysFromNow(30) })
    expect(getGymStatus(gym)).toBe("suspended")
  })

  it("marks subscriptions past their end date as expired", () => {
    const gym = makeGym({ subscriptionEndDate: isoDaysFromNow(-1) })
    expect(getGymStatus(gym)).toBe("expired")
  })

  it("marks subscriptions ending within 14 days as renewal-due", () => {
    const gym = makeGym({ subscriptionEndDate: isoDaysFromNow(10) })
    expect(getGymStatus(gym)).toBe("renewal-due")
  })

  it("marks subscriptions with runway beyond 14 days as active", () => {
    const gym = makeGym({ subscriptionEndDate: isoDaysFromNow(30) })
    expect(getGymStatus(gym)).toBe("active")
  })
})

describe("getTrialState", () => {
  it("treats paid plans as paid regardless of dates", () => {
    const gym = makeGym({
      plan: "pro",
      subscriptionEndDate: isoDaysFromNow(-1),
    })
    expect(getTrialState(gym)).toBe("paid")
  })

  it("reports a trial with runway as active", () => {
    const gym = makeGym({
      plan: "trial",
      subscriptionEndDate: isoDaysFromNow(6),
    })
    expect(getTrialState(gym)).toBe("trial-active")
  })

  it("reports a trial past its end date as expired", () => {
    const gym = makeGym({
      plan: "trial",
      subscriptionEndDate: isoDaysFromNow(-1),
    })
    expect(getTrialState(gym)).toBe("expired")
  })
})

describe("trialDaysRemaining", () => {
  it("counts whole days left on a live trial", () => {
    const gym = makeGym({
      plan: "trial",
      subscriptionEndDate: isoDaysFromNow(7),
    })
    expect(trialDaysRemaining(gym)).toBe(7)
  })

  it("clamps to zero once the trial has ended", () => {
    const gym = makeGym({
      plan: "trial",
      subscriptionEndDate: isoDaysFromNow(-3),
    })
    expect(trialDaysRemaining(gym)).toBe(0)
  })
})
