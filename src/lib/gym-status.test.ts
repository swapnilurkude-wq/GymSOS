import { describe, expect, it } from "vitest"
import { getGymStatus } from "@/lib/gym-status"
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
