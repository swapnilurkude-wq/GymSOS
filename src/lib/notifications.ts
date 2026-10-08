import { getMembersByGym } from "@/lib/members"
import { getAllGyms } from "@/lib/gyms"
import { getReceiptsByGym, getAllReceipts } from "@/lib/receipts"
import { getMemberStatus } from "@/lib/member-status"
import { getGymStatus, getTrialState, trialDaysRemaining } from "@/lib/gym-status"
import { formatCurrency } from "@/lib/format"
import type { NotificationPreferences } from "@/hooks/use-preferences"
import type { AppNotification } from "@/types"

const DAY_MS = 1000 * 60 * 60 * 24
const RECENT_DAYS = 3
const MAX_NOTIFICATIONS = 20

function isRecent(iso: string, days = RECENT_DAYS): boolean {
  return Date.now() - new Date(iso).getTime() <= days * DAY_MS
}

function sortAndCap(items: AppNotification[]): AppNotification[] {
  return items
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, MAX_NOTIFICATIONS)
}

export async function computeGymOwnerNotifications(
  gymId: string,
  preferences: NotificationPreferences
): Promise<AppNotification[]> {
  if (!gymId) return []

  const [members, receipts, gyms] = await Promise.all([
    getMembersByGym(gymId),
    getReceiptsByGym(gymId),
    getAllGyms(),
  ])
  const items: AppNotification[] = []

  // Free-trial reminders. The trial end date comes
  // from the gym row in the database, so the
  // countdown can't be extended from the browser.
  const gym = gyms.find((g) => g.id === gymId)
  if (gym && getTrialState(gym) === "trial-active") {
    const days = trialDaysRemaining(gym)
    if (days === 1) {
      items.push({
        id: `trial-tomorrow-${gym.id}`,
        title: "Your free trial expires tomorrow.",
        time: gym.subscriptionEndDate,
        tone: "warning",
        link: "/gym-owner/settings",
      })
    } else if (days <= 3) {
      items.push({
        id: `trial-expiring-${gym.id}`,
        title: `Your free trial expires in ${days} days.`,
        time: gym.subscriptionEndDate,
        tone: "warning",
        link: "/gym-owner/settings",
      })
    }
  }

  if (preferences.renewalReminders) {
    for (const m of members) {
      const status = getMemberStatus(m)
      if (status === "expiring") {
        items.push({
          id: `expiring-${m.id}`,
          title: `${m.name}'s membership is expiring soon`,
          time: m.endDate,
          tone: "warning",
          link: "/gym-owner/members",
        })
      } else if (status === "expired" && isRecent(m.endDate, 7)) {
        items.push({
          id: `expired-${m.id}`,
          title: `${m.name}'s membership has expired`,
          time: m.endDate,
          tone: "destructive",
          link: "/gym-owner/members",
        })
      }
    }
  }

  if (preferences.paymentAlerts) {
    for (const r of receipts) {
      if (isRecent(r.createdAt)) {
        items.push({
          id: `payment-${r.id}`,
          title: `Payment of ${formatCurrency(r.amountPaid)} received from ${r.memberName}`,
          time: r.createdAt,
          tone: "success",
          link: "/gym-owner/receipts",
        })
      }
    }

    for (const m of members) {
      if (getMemberStatus(m) === "pending" && isRecent(m.updatedAt, 7)) {
        items.push({
          id: `pending-${m.id}`,
          title: `${m.name} has an outstanding balance of ${formatCurrency(m.balanceAmount)}`,
          time: m.updatedAt,
          tone: "warning",
          link: "/gym-owner/payments",
        })
      }
    }
  }

  for (const m of members) {
    if (isRecent(m.createdAt)) {
      items.push({
        id: `new-member-${m.id}`,
        title: `New member registered: ${m.name}`,
        time: m.createdAt,
        tone: "default",
        link: "/gym-owner/members",
      })
    }
  }

  return sortAndCap(items)
}

export async function computeSuperAdminNotifications(
  preferences: NotificationPreferences
): Promise<AppNotification[]> {
  const [gyms, receipts] = await Promise.all([getAllGyms(), getAllReceipts()])
  const gymNameById = Object.fromEntries(gyms.map((g) => [g.id, g.name]))
  const items: AppNotification[] = []

  if (preferences.renewalReminders) {
    for (const g of gyms) {
      const status = getGymStatus(g)
      if (status === "renewal-due") {
        items.push({
          id: `gym-renewal-${g.id}`,
          title: `${g.name}'s subscription renews soon`,
          time: g.subscriptionEndDate,
          tone: "warning",
          link: "/super-admin/subscriptions",
        })
      } else if (status === "expired" && isRecent(g.subscriptionEndDate, 7)) {
        items.push({
          id: `gym-expired-${g.id}`,
          title: `${g.name}'s subscription has expired`,
          time: g.subscriptionEndDate,
          tone: "destructive",
          link: "/super-admin/subscriptions",
        })
      }
    }
  }

  if (preferences.paymentAlerts) {
    for (const r of receipts) {
      if (isRecent(r.createdAt)) {
        items.push({
          id: `gym-payment-${r.id}`,
          title: `Payment of ${formatCurrency(r.amountPaid)} received from ${r.memberName} at ${
            gymNameById[r.gymId] ?? "a gym"
          }`,
          time: r.createdAt,
          tone: "success",
          link: "/super-admin/receipts",
        })
      }
    }
  }

  for (const g of gyms) {
    if (isRecent(g.createdAt, 7)) {
      items.push({
        id: `new-gym-${g.id}`,
        title:
          g.plan === "trial"
            ? `${g.name} started a 10-day free trial`
            : `New gym onboarded: ${g.name}`,
        time: g.createdAt,
        tone: "default",
        link: g.plan === "trial" ? "/super-admin/subscriptions" : "/super-admin/gyms",
      })
    }
  }

  return sortAndCap(items)
}
