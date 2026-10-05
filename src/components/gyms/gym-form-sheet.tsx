import { useEffect, useState, type FormEvent } from "react"
import { AlertTriangle, Eye, EyeOff, Sparkles, Info } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { blankGymValues, gymToFormValues } from "@/lib/gym-defaults"
import { getPlanFeatures, PLAN_LABEL } from "@/lib/plan-features"
import { findUserByEmail, generatePassword } from "@/lib/auth-users"
import { formatNumber } from "@/lib/format"
import type { AuthUser, Gym, GymFormValues, GymPlan, GymStatus } from "@/types"

function toInputDate(iso: string): string {
  return iso ? iso.slice(0, 10) : ""
}

interface GymFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gym: Gym | null
  existingAccount: AuthUser | null
  onSave: (values: GymFormValues, accountPassword?: string) => void
}

export function GymFormSheet({ open, onOpenChange, gym, existingAccount, onSave }: GymFormSheetProps) {
  const [values, setValues] = useState<GymFormValues>(blankGymValues)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [resetPassword, setResetPassword] = useState(false)

  useEffect(() => {
    if (open) {
      setValues(gym ? gymToFormValues(gym) : blankGymValues())
      setPassword("")
      setShowPassword(false)
      setResetPassword(false)
    }
  }, [open, gym])

  function update<K extends keyof GymFormValues>(key: K, value: GymFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const isCreating = !gym
  const [emailConflict, setEmailConflict] = useState(false)

  useEffect(() => {
    const email = values.ownerEmail.trim()
    if (!email) {
      setEmailConflict(false)
      return
    }
    let cancelled = false
    findUserByEmail(email, existingAccount?.id)
      .then((user) => {
        if (!cancelled) setEmailConflict(!!user)
      })
      .catch(() => {
        if (!cancelled) setEmailConflict(false)
      })
    return () => {
      cancelled = true
    }
  }, [values.ownerEmail, existingAccount?.id])

  const passwordProvided = password.trim().length > 0
  const passwordValid = !passwordProvided || password.trim().length >= 6

  const canSubmit =
    values.name.trim().length > 0 &&
    values.location.trim().length > 0 &&
    values.ownerName.trim().length > 0 &&
    values.ownerEmail.trim().length > 0 &&
    !emailConflict &&
    passwordValid &&
    (!isCreating || passwordProvided)

  const planFeatures = getPlanFeatures(values.plan)
  const exceedsMemberCap = planFeatures.maxMembers !== null && values.memberCount > planFeatures.maxMembers

  function handleGeneratePassword() {
    setPassword(generatePassword())
    setShowPassword(true)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onSave(values, passwordProvided ? password.trim() : undefined)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{gym ? "Edit Gym" : "Add New Gym"}</SheetTitle>
          <SheetDescription>
            {gym ? "Update this gym's profile and subscription details" : "Onboard a new gym to the platform"}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="contents">
          <SheetBody className="flex flex-col gap-8">
            <section className="flex flex-col gap-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Gym Details
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="gym-name">Gym name *</Label>
                  <Input
                    id="gym-name"
                    value={values.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="e.g. Iron Pulse Fitness"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="gym-location">Location *</Label>
                  <Input
                    id="gym-location"
                    value={values.location}
                    onChange={(e) => update("location", e.target.value)}
                    placeholder="City, State"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="member-count">Member count</Label>
                  <Input
                    id="member-count"
                    type="number"
                    min={0}
                    value={values.memberCount}
                    onChange={(e) => update("memberCount", Number(e.target.value))}
                  />
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Owner Details
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="owner-name">Owner name *</Label>
                  <Input
                    id="owner-name"
                    value={values.ownerName}
                    onChange={(e) => update("ownerName", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="owner-contact">Owner contact</Label>
                  <Input
                    id="owner-contact"
                    value={values.ownerContact}
                    onChange={(e) => update("ownerContact", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="owner-email">Owner email * (also their login email)</Label>
                  <Input
                    id="owner-email"
                    type="email"
                    value={values.ownerEmail}
                    onChange={(e) => update("ownerEmail", e.target.value)}
                  />
                  {emailConflict && (
                    <p className="flex items-start gap-1.5 text-xs text-destructive">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      This email is already used by another account. Choose a different one.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Login Account
              </h3>

              {isCreating && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  Creates a gym-owner login using the email above. The owner can sign in immediately after
                  you save.
                </p>
              )}

              {!isCreating && !existingAccount && (
                <p className="flex items-start gap-1.5 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  This gym doesn't have a login account yet. Set a password below to create one.
                </p>
              )}

              {!isCreating && existingAccount && !resetPassword && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3.5 py-2.5 text-sm">
                  <span className="text-muted-foreground">
                    Login email: <span className="text-foreground">{existingAccount.email}</span>
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setResetPassword(true)}>
                    Reset password
                  </Button>
                </div>
              )}

              {(isCreating || !existingAccount || resetPassword) && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="account-password">
                    {isCreating ? "Password *" : "New password"}
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="account-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={isCreating ? "Set a password" : "Leave blank to keep unchanged"}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <Button type="button" variant="outline" onClick={handleGeneratePassword}>
                      <Sparkles className="size-3.5" />
                      Generate
                    </Button>
                    {!isCreating && existingAccount && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setResetPassword(false)
                          setPassword("")
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                  {!passwordValid && (
                    <p className="text-xs text-destructive">Password must be at least 6 characters.</p>
                  )}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Subscription
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Plan</Label>
                  <Select value={values.plan} onValueChange={(v) => update("plan", v as GymPlan)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="growth">Growth</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                    </SelectContent>
                  </Select>
                  {exceedsMemberCap && (
                    <p className="flex items-start gap-1.5 text-xs text-warning">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      {formatNumber(values.memberCount)} members exceeds the {PLAN_LABEL[values.plan]} plan's
                      {" "}
                      {planFeatures.maxMembers}-member limit.
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Account status</Label>
                  <Select value={values.status} onValueChange={(v) => update("status", v as GymStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="sub-end">Subscription renews / expires on</Label>
                  <Input
                    id="sub-end"
                    type="date"
                    value={toInputDate(values.subscriptionEndDate)}
                    onChange={(e) => update("subscriptionEndDate", new Date(e.target.value).toISOString())}
                  />
                </div>
              </div>
            </section>
          </SheetBody>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {gym ? "Save Changes" : "Add Gym"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
