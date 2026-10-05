import { describe, expect, it } from "vitest"
import { getMemberStatus } from "@/lib/member-status"
import { isoDaysFromNow, makeMember } from "@/test/helpers"

describe("getMemberStatus", () => {
  it("marks memberships past their end date as expired", () => {
    const member = makeMember({ endDate: isoDaysFromNow(-1) })
    expect(getMemberStatus(member)).toBe("expired")
  })

  it("expired wins over an outstanding balance", () => {
    const member = makeMember({ endDate: isoDaysFromNow(-1), balanceAmount: 500 })
    expect(getMemberStatus(member)).toBe("expired")
  })

  it("marks members with an outstanding balance as pending", () => {
    const member = makeMember({ endDate: isoDaysFromNow(30), balanceAmount: 7000 })
    expect(getMemberStatus(member)).toBe("pending")
  })

  it("marks memberships ending within 7 days as expiring", () => {
    const member = makeMember({ endDate: isoDaysFromNow(3), balanceAmount: 0 })
    expect(getMemberStatus(member)).toBe("expiring")
  })

  it("marks healthy memberships as active", () => {
    const member = makeMember({ endDate: isoDaysFromNow(30), balanceAmount: 0 })
    expect(getMemberStatus(member)).toBe("active")
  })
})
