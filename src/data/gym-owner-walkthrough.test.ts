import { describe, expect, it } from "vitest"
import { installMemoryStorage, makeMember } from "@/test/helpers"
import { ensureSeeded } from "@/data/seed"
import { STORAGE_KEYS, readStorage, writeStorage, removeStorage } from "@/lib/storage"
import { getMembersByGym, createMember, updateMember } from "@/lib/members"
import { memberToFormValues } from "@/lib/member-defaults"
import { recordPaymentValues } from "@/lib/payments"
import {
  computeGymKpiStats,
  computeGymPlanMix,
  computeGymRevenueTrend,
} from "@/lib/dashboard-stats"
import { getMemberStatus, MEMBER_STATUS_META } from "@/lib/member-status"
import { getPlanFeatures, PLAN_LABEL } from "@/lib/plan-features"
import { createReceipt, receiptValuesFromMember } from "@/lib/receipts"
import { getReceiptTemplate } from "@/lib/receipt-template"
import { getAllGyms } from "@/lib/gyms"
import { formatCurrency } from "@/lib/format"
import type { AuthUser, Session } from "@/types"

describe("gym owner walkthrough", () => {
  it("logs in and works through the gym-owner journey", async () => {
    installMemoryStorage()
    await ensureSeeded()

    // 1. Login (mirrors auth-context login)
    const users = readStorage<AuthUser[]>(STORAGE_KEYS.users, [])
    const owner = users.find(
      (u) => u.email.toLowerCase() === "owner@ironpulse.com" && u.password === "Owner@123"
    )
    expect(owner).toBeDefined()

    const session: Session = {
      userId: owner!.id,
      role: owner!.role,
      name: owner!.name,
      email: owner!.email,
      avatarUrl: owner!.avatarUrl,
      gymId: owner!.gymId,
      gymName: owner!.gymName,
    }
    writeStorage(STORAGE_KEYS.session, session)

    const gymId = session.gymId!
    const gym = (await getAllGyms()).find((g) => g.id === gymId)!

    console.log(`\n=== Gym Owner Walkthrough: ${session.name} ===`)
    console.log(`Gym: ${gym.name} (${gym.location}) — Plan: ${PLAN_LABEL[gym.plan]}`)
    const features = getPlanFeatures(gym.plan)
    console.log(
      `Features: members=${features.maxMembers ?? "unlimited"}, excelExport=${features.excelExport}, excelImport=${features.excelImport}, pdfReceipts=${features.pdfReceipts}, reports=${features.reports}`
    )

    // 2. Dashboard
    const members = await getMembersByGym(gymId)
    const stats = computeGymKpiStats(members)
    console.log("\n--- Dashboard KPIs ---")
    for (const s of stats) {
      const value = s.format === "currency" ? formatCurrency(s.value) : String(s.value)
      console.log(`${s.label}: ${value} (${s.context})`)
    }

    const trend = computeGymRevenueTrend(members)
    console.log(`\nRevenue trend (last month): ${formatCurrency(trend[trend.length - 1].revenue)}`)
    console.log(
      "Plan mix:",
      computeGymPlanMix(members)
        .map((p) => `${p.name}=${p.value}`)
        .join(", ")
    )

    // 3. Members list with statuses
    console.log("\n--- Members ---")
    for (const m of members) {
      const status = getMemberStatus(m)
      console.log(`${m.name} — ${MEMBER_STATUS_META[status].label}`)
    }

    // 4. Add a new member with a partial payment
    const newMemberValues = {
      ...memberToFormValues(makeMember({ name: "Walkthrough Member" })),
      plan: "Quarterly" as const,
      durationMonths: 3,
      amount: 5000,
      discount: 0,
      paidAmount: 3000,
      cashAmount: 3000,
      onlineAmount: 0,
      paymentMode: "cash" as const,
      balanceAmount: 0,
    }
    const created = await createMember(gymId, newMemberValues)
    expect(created.receiptNumber).toBe("IPF-0009")
    expect(created.balanceAmount).toBe(2000)
    console.log(`\nAdded ${created.name}: receipt ${created.receiptNumber}, balance ${formatCurrency(created.balanceAmount)}`)

    // 5. Record the outstanding payment
    const paid = recordPaymentValues(created, 2000, "cash", "Rahul Deshmukh")
    expect(paid.paidAmount).toBe(5000)
    const settled = (await updateMember(created.id, paid))!
    expect(settled.balanceAmount).toBe(0)
    console.log(`Payment recorded: ${formatCurrency(2000)} — new balance ${formatCurrency(settled.balanceAmount)}`)

    // 6. Generate a receipt
    const receipt = await createReceipt(gymId, receiptValuesFromMember(settled))
    expect(receipt.receiptNumber).toBe("IPF-RCT-0001")
    expect(receipt.status).toBe("paid")
    console.log(`Receipt ${receipt.receiptNumber}: status=${receipt.status}`)

    // 7. Receipt template is configured for the gym
    const template = await getReceiptTemplate(gymId)
    expect(template?.gymName).toBe(gym.name)
    console.log(`Receipt template: ${template!.gymName} — ${template!.gymAddress}`)

    // Excel export is available on the Pro plan (exportMembersToExcel
    // writes via XLSX.writeFile, which needs a real filesystem —
    // not available inside the test worker).
    console.log("Excel export: available (Pro plan)")

    // 8. Logout
    removeStorage(STORAGE_KEYS.session)
    expect(readStorage<Session | null>(STORAGE_KEYS.session, null)).toBeNull()
    console.log("Logged out — session cleared")

    const membersAfter = await getMembersByGym(gymId)
    expect(membersAfter).toHaveLength(9)
  })
})
