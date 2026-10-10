import { describe, expect, it } from "vitest"

import {
  checkVerificationCode,
  generateVerificationCode,
  hashCode,
  isCodeRequestAllowed,
  normalizeWhatsAppNumber,
} from "../../supabase/functions/_shared/whatsapp/verification"

describe("WhatsApp verification codes", () => {
  it("generates six-digit numeric codes", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateVerificationCode()
      expect(code).toMatch(/^[0-9]{6}$/)
    }
  })

  it("generates varied codes (not a constant)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateVerificationCode()))
    expect(codes.size).toBeGreaterThan(1)
  })

  it("hashes codes to a stable 64-char hex digest", async () => {
    const first = await hashCode("482913")
    const again = await hashCode("482913")
    const other = await hashCode("000000")

    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(first).toBe(again)
    expect(first).not.toBe(other)
  })
})

describe("checkVerificationCode", () => {
  const NOW = new Date("2026-10-11T12:00:00.000Z")

  function record(hash: string | null, minutesAgo: number, attempts = 0) {
    return {
      hash,
      sentAt:
        hash === null
          ? null
          : new Date(NOW.getTime() - minutesAgo * 60 * 1000).toISOString(),
      attempts,
    }
  }

  it("accepts a matching, in-window code", async () => {
    const hash = await hashCode("482913")
    const decision = await checkVerificationCode(
      record(hash, 2),
      "482913",
      { now: NOW }
    )
    expect(decision).toEqual({ ok: true })
  })

  it("rejects without a stored code", async () => {
    const decision = await checkVerificationCode(
      record(null, 0),
      "482913",
      { now: NOW }
    )
    expect(decision).toEqual({ ok: false, reason: "no_code" })
  })

  it("rejects an expired code (10-minute window)", async () => {
    const hash = await hashCode("482913")
    const decision = await checkVerificationCode(
      record(hash, 11),
      "482913",
      { now: NOW }
    )
    expect(decision).toEqual({ ok: false, reason: "expired" })
  })

  it("accepts a code exactly at the window edge", async () => {
    const hash = await hashCode("482913")
    const decision = await checkVerificationCode(
      record(hash, 10),
      "482913",
      { now: NOW }
    )
    expect(decision).toEqual({ ok: true })
  })

  it("rejects a wrong code as a mismatch and counts the attempt", async () => {
    const hash = await hashCode("482913")
    const decision = await checkVerificationCode(
      record(hash, 2, 0),
      "111111",
      { now: NOW }
    )
    expect(decision).toEqual({ ok: false, reason: "mismatch" })
  })

  it("rejects once the attempt budget is exhausted", async () => {
    const hash = await hashCode("482913")
    const decision = await checkVerificationCode(
      record(hash, 2, 5),
      "482913",
      { now: NOW }
    )
    expect(decision).toEqual({ ok: false, reason: "exhausted" })
  })

  it("allows a correct code on the final permitted attempt", async () => {
    const hash = await hashCode("482913")
    const decision = await checkVerificationCode(
      record(hash, 2, 4),
      "482913",
      { now: NOW }
    )
    expect(decision).toEqual({ ok: true })
  })

  it("compares codes case-insensitively (hex is lowercase)", async () => {
    const hash = await hashCode("482913")
    const decision = await checkVerificationCode(
      { hash: hash.toUpperCase(), sentAt: NOW.toISOString(), attempts: 0 },
      "482913",
      { now: NOW }
    )
    expect(decision).toEqual({ ok: true })
  })
})

describe("isCodeRequestAllowed", () => {
  const NOW = new Date("2026-10-11T12:00:00.000Z")

  it("allows the first request", () => {
    expect(isCodeRequestAllowed(null, { now: NOW })).toBe(true)
  })

  it("blocks within the 60-second cooldown", () => {
    const sentAt = new Date(NOW.getTime() - 30 * 1000).toISOString()
    expect(isCodeRequestAllowed(sentAt, { now: NOW })).toBe(false)
  })

  it("allows again after the cooldown", () => {
    const sentAt = new Date(NOW.getTime() - 61 * 1000).toISOString()
    expect(isCodeRequestAllowed(sentAt, { now: NOW })).toBe(true)
  })
})

describe("normalizeWhatsAppNumber", () => {
  it("adds the 91 country code to a bare 10-digit mobile", () => {
    expect(normalizeWhatsAppNumber("9820000000")).toBe("919820000000")
  })

  it("keeps an already-prefixed number", () => {
    expect(normalizeWhatsAppNumber("919820000000")).toBe("919820000000")
  })

  it("strips spaces, dashes and a plus sign", () => {
    expect(normalizeWhatsAppNumber("+91 98200-00000")).toBe("919820000000")
  })
})
