import { STORAGE_KEYS, readStorage, writeStorage } from "@/lib/storage"
import { MEMBER_SEED } from "@/data/member-seed"
import { GYM_SEED } from "@/data/gym-seed"
import { getReceiptTemplate, upsertReceiptTemplate } from "@/lib/receipt-template"
import { isDemoMode } from "@/lib/supabase"
import type { AuthUser, Gym, Member } from "@/types"

const SUPER_ADMIN: AuthUser = {
  id: "user-super-admin",
  name: "Platform Admin",
  email: "admin@gymsos.demo",
  password: "DemoAdmin@123",
  role: "super-admin",
  createdAt: new Date(2026, 0, 1).toISOString(),
}

const DEMO_GYM: Gym = GYM_SEED[0]

const DEMO_GYM_OWNER: AuthUser = {
  id: "user-gym-owner-1",
  name: "Rahul Deshmukh",
  email: "owner@ironpulse.com",
  password: "Owner@123",
  role: "gym-owner",
  gymId: DEMO_GYM.id,
  gymName: DEMO_GYM.name,
  createdAt: new Date(2026, 0, 5).toISOString(),
}

/**
 * Updates the existing demo Super Admin account when credentials change.
 * Existing users, gyms and members are preserved.
 */
function migrateSuperAdminCredentials(): void {
  const users = readStorage<AuthUser[]>(STORAGE_KEYS.users, [])

  if (users.length === 0) return

  const updatedUsers = users.map((user) => {
    if (
      user.id === SUPER_ADMIN.id ||
      user.role === "super-admin"
    ) {
      return {
        ...user,
        email: SUPER_ADMIN.email,
        password: SUPER_ADMIN.password,
      }
    }

    return user
  })

  writeStorage<AuthUser[]>(STORAGE_KEYS.users, updatedUsers)

  // Remove any saved session using the old Super Admin credentials.
  const session = readStorage<{
    userId?: string
  } | null>(STORAGE_KEYS.session, null)

  if (session?.userId === SUPER_ADMIN.id) {
    writeStorage(STORAGE_KEYS.session, null)
  }
}

/**
 * Seeds the demo dataset into localStorage.
 * Development (demo) mode only — production data is
 * seeded with supabase/seed.sql and lives in Postgres.
 */
export async function ensureSeeded(): Promise<void> {
  if (!isDemoMode()) return

  const alreadySeeded = readStorage<boolean>(STORAGE_KEYS.seeded, false)

  // If the app was already seeded previously, migrate the
  // existing Super Admin credentials instead of reseeding
  // and deleting/replacing existing data.
  if (alreadySeeded) {
    migrateSuperAdminCredentials()
    return
  }

  // Default receipt template first, so a failure here can't leave the
  // platform marked as seeded without it.
  if (!(await getReceiptTemplate(DEMO_GYM.id))) {
    await upsertReceiptTemplate(DEMO_GYM.id, {
      gymName: DEMO_GYM.name,
      gymAddress: "Baner Road, Pune, Maharashtra",
      contactNumber: DEMO_GYM.ownerContact,
      termsAndConditions:
        "Membership is non-transferable and non-refundable. Fees are billed for the chosen duration and renew automatically unless cancelled before the renewal date. The gym is not responsible for loss or damage to personal belongings.",
      authorizedSignatureName: DEMO_GYM.ownerName,
    })
  }

  writeStorage<AuthUser[]>(STORAGE_KEYS.users, [SUPER_ADMIN, DEMO_GYM_OWNER])
  writeStorage<Gym[]>(STORAGE_KEYS.gyms, GYM_SEED)
  writeStorage<Member[]>(STORAGE_KEYS.members, MEMBER_SEED)
  writeStorage(STORAGE_KEYS.receiptCounters, { [DEMO_GYM.id]: MEMBER_SEED.length })
  writeStorage(STORAGE_KEYS.seeded, true)
}

export const DEMO_CREDENTIALS = {
  superAdmin: {
    email: SUPER_ADMIN.email,
    password: SUPER_ADMIN.password,
  },
  gymOwner: {
    email: DEMO_GYM_OWNER.email,
    password: DEMO_GYM_OWNER.password,
  },
}