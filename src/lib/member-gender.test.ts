import { describe, expect, it } from "vitest"
import { memberValuesFromReceiptForm } from "@/lib/members"
import { blankReceiptValues } from "@/lib/receipt-defaults"
import type { Gender } from "@/types"

describe("member gender capture", () => {
  it("carries the chosen gender into the member record", () => {
    const member = memberValuesFromReceiptForm({
      ...blankReceiptValues(),
      memberName: "New Member",
      memberContact: "9820000000",
      gender: "undisclosed",
    })

    expect(member.gender).toBe("undisclosed")
    expect(member.name).toBe("New Member")
  })

  it("defaults new members to 'other'", () => {
    const member = memberValuesFromReceiptForm(blankReceiptValues())
    expect(member.gender).toBe("other")
  })

  it("keeps every gender option valid for the form", () => {
    const options: Gender[] = ["male", "female", "other", "undisclosed"]
    for (const gender of options) {
      const member = memberValuesFromReceiptForm({
        ...blankReceiptValues(),
        gender,
      })
      expect(member.gender).toBe(gender)
    }
  })
})
