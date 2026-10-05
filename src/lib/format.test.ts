import { describe, expect, it } from "vitest"
import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
  formatRelativeDays,
  formatSignedPercent,
  formatTimeAgo,
} from "@/lib/format"
import { isoDaysFromNow } from "@/test/helpers"

describe("formatCurrency", () => {
  it("formats INR with Indian digit grouping", () => {
    expect(formatCurrency(1234567)).toBe("₹12,34,567")
    expect(formatCurrency(999)).toBe("₹999")
  })
})

describe("formatNumber", () => {
  it("rounds and formats with Indian digit grouping", () => {
    expect(formatNumber(12345.6)).toBe("12,346")
  })
})

describe("formatCompactCurrency", () => {
  it("compacts large amounts to L and Cr", () => {
    expect(formatCompactCurrency(150000)).toBe("₹1.5L")
    expect(formatCompactCurrency(15000000)).toBe("₹1.5Cr")
  })

  it("falls back to the full currency below ₹1,000", () => {
    expect(formatCompactCurrency(999)).toBe("₹999")
  })
})

describe("formatSignedPercent", () => {
  it("prefixes positive deltas with a plus sign", () => {
    expect(formatSignedPercent(2.5)).toBe("+2.5%")
  })

  it("keeps the sign and one decimal place", () => {
    expect(formatSignedPercent(-3)).toBe("-3.0%")
    expect(formatSignedPercent(0)).toBe("0.0%")
  })
})

describe("formatRelativeDays", () => {
  it("labels future dates as upcoming", () => {
    expect(formatRelativeDays(isoDaysFromNow(5))).toBe("in 5 days")
    expect(formatRelativeDays(isoDaysFromNow(1))).toBe("in 1 day")
  })

  it("labels past dates as overdue", () => {
    expect(formatRelativeDays(isoDaysFromNow(-3))).toBe("3 days overdue")
  })

  it("labels the current day as Today", () => {
    expect(formatRelativeDays(new Date().toISOString())).toBe("Today")
  })
})

describe("formatTimeAgo", () => {
  it("reports the current instant as just now", () => {
    expect(formatTimeAgo(new Date().toISOString())).toBe("just now")
  })

  it("reports minutes, hours and days", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(formatTimeAgo(fiveMinutesAgo)).toBe("5m ago")

    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    expect(formatTimeAgo(threeHoursAgo)).toBe("3h ago")

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatTimeAgo(twoDaysAgo)).toBe("2d ago")
  })
})
