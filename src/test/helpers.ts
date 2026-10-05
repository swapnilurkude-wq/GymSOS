import type { Gym, Member } from "@/types"

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Installs an in-memory localStorage so storage-backed modules
 * (seed, auth-users, members, gyms, receipts) work under Vitest's
 * Node environment. Call before importing/using any storage helper.
 */
export function installMemoryStorage(): void {
  const store = new Map<string, string>()
  const storage: Storage = {
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  }
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  })
}

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY_MS)
}

export function isoDaysFromNow(days: number): string {
  return daysFromNow(days).toISOString()
}

/** First day of the previous month — always in a different month than "now". */
export function isoFirstOfPreviousMonth(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - 1, 1, 12).toISOString()
}

export function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: "member-test-1",
    gymId: "gym-demo-1",
    receiptNumber: "IPF-0001",
    name: "Priya Kulkarni",
    contactNumber: "9822011234",
    gender: "female",
    address: "Baner Road, Pune",
    memberType: "new",
    plan: "Monthly",
    durationMonths: 1,
    startDate: isoDaysFromNow(-5),
    endDate: isoDaysFromNow(25),
    amount: 2500,
    discount: 0,
    paidAmount: 2500,
    balanceAmount: 0,
    paymentMode: "cash",
    cashAmount: 2500,
    onlineAmount: 0,
    paymentReceiver: "Rahul Deshmukh",
    paymentDate: isoDaysFromNow(-5),
    notes: "",
    termsAccepted: true,
    createdAt: isoDaysFromNow(-5),
    updatedAt: isoDaysFromNow(-5),
    ...overrides,
  }
}

export function makeGym(overrides: Partial<Gym> = {}): Gym {
  return {
    id: "gym-test-1",
    name: "Iron Pulse Fitness",
    location: "Pune, Maharashtra",
    plan: "pro",
    status: "active",
    ownerName: "Rahul Deshmukh",
    ownerEmail: "owner@ironpulse.com",
    ownerContact: "9822099001",
    memberCount: 482,
    subscriptionEndDate: isoDaysFromNow(30),
    createdAt: isoDaysFromNow(-90),
    ...overrides,
  }
}
