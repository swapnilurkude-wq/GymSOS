import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { CheckCircle2, X } from "lucide-react"
import { useGyms } from "@/hooks/use-gyms"
import { DataErrorBanner } from "@/components/shared/data-error-banner"
import { GymToolbar, type GymFilters } from "@/components/gyms/gym-toolbar"
import { GymTable } from "@/components/gyms/gym-table"
import { GymFormSheet } from "@/components/gyms/gym-form-sheet"
import { GymCredentialsDialog, type GeneratedCredentials } from "@/components/gyms/gym-credentials-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getGymStatus } from "@/lib/gym-status"
import { findUserByGymId, upsertGymOwnerAccount } from "@/lib/auth-users"
import type { AuthUser, Gym, GymFormValues } from "@/types"

const DEFAULT_FILTERS: GymFilters = { search: "", status: "all", plan: "all" }

export default function GymManagementPage() {
  const { gyms, error, refresh, addGym, editGym, removeGym } = useGyms()

  const [filters, setFilters] = useState<GymFilters>(DEFAULT_FILTERS)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingGym, setEditingGym] = useState<Gym | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Gym | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [revealCredentials, setRevealCredentials] = useState<GeneratedCredentials | null>(null)
  const [existingAccount, setExistingAccount] = useState<AuthUser | null>(null)

  useEffect(() => {
    if (!editingGym) {
      setExistingAccount(null)
      return
    }
    let cancelled = false
    findUserByGymId(editingGym.id)
      .then((user) => {
        if (!cancelled) setExistingAccount(user ?? null)
      })
      .catch(() => {
        if (!cancelled) setExistingAccount(null)
      })
    return () => {
      cancelled = true
    }
  }, [editingGym])

  const filteredGyms = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    return gyms.filter((g) => {
      if (query) {
        const haystack = `${g.name} ${g.location} ${g.ownerName}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      if (filters.status !== "all" && getGymStatus(g) !== filters.status) return false
      if (filters.plan !== "all" && g.plan !== filters.plan) return false
      return true
    })
  }, [gyms, filters])

  function openAddForm() {
    setEditingGym(null)
    setSheetOpen(true)
  }

  function openEditForm(gym: Gym) {
    setEditingGym(gym)
    setSheetOpen(true)
  }

  async function handleSave(values: GymFormValues, accountPassword?: string) {
    if (editingGym) {
      const updated = (await editGym(editingGym.id, values)) ?? {
        ...editingGym,
        ...values,
      }
      if (existingAccount || accountPassword) {
        try {
          const account = await upsertGymOwnerAccount({
            gymId: updated.id,
            gymName: updated.name,
            ownerName: updated.ownerName,
            email: updated.ownerEmail,
            password: accountPassword,
          })
          if (accountPassword) {
            setRevealCredentials({ gymName: updated.name, email: account.email, password: accountPassword })
          }
        } catch (error) {
          setBanner(
            error instanceof Error
              ? error.message
              : `${values.name}'s details were updated, but the owner login couldn't be changed.`
          )
          setSheetOpen(false)
          return
        }
      }
      setBanner(`${values.name}'s details were updated.`)
    } else {
      const created = await addGym(values)
      if (accountPassword) {
        try {
          const account = await upsertGymOwnerAccount({
            gymId: created.id,
            gymName: created.name,
            ownerName: created.ownerName,
            email: created.ownerEmail,
            password: accountPassword,
          })
          setRevealCredentials({ gymName: created.name, email: account.email, password: accountPassword })
        } catch (error) {
          setBanner(
            error instanceof Error
              ? error.message
              : `${values.name} was onboarded, but the owner login couldn't be created.`
          )
          setSheetOpen(false)
          return
        }
      }
      setBanner(`${values.name} was onboarded successfully.`)
    }
    setSheetOpen(false)
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    await removeGym(deleteTarget.id)
    setBanner(`${deleteTarget.name} was removed from the platform.`)
    setDeleteTarget(null)
  }

  return (
    <div className="flex flex-col gap-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1"
      >
        <h1 className="font-display text-xl font-semibold text-foreground">Gym Management</h1>
        <p className="text-sm text-muted-foreground">{gyms.length} gyms on the platform</p>
      </motion.div>

      <DataErrorBanner error={error} onRetry={refresh} />

      {banner && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            {banner}
          </div>
          <button onClick={() => setBanner(null)} aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      )}

      <GymToolbar filters={filters} onFiltersChange={setFilters} onAddGym={openAddForm} />

      <GymTable gyms={filteredGyms} onEdit={openEditForm} onDelete={setDeleteTarget} />

      <GymFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        gym={editingGym}
        existingAccount={existingAccount}
        onSave={handleSave}
      />

      <GymCredentialsDialog
        credentials={revealCredentials}
        onOpenChange={(open) => !open && setRevealCredentials(null)}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove gym?</DialogTitle>
            <DialogDescription>
              This will permanently remove {deleteTarget?.name} and its subscription record from the
              platform. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Remove gym
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
