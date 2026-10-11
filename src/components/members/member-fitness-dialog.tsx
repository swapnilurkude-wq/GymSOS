import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  formatExercises,
  getMemberFitness,
  parseExercises,
  saveMemberFitness,
  type FitnessLevel,
  type MemberFitnessValues,
} from "@/lib/member-fitness"
import type { Member } from "@/types"

interface MemberFitnessDialogProps {
  member: Member | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

/**
 * Manages a member's fitness profile
 * and workout plan. Daily fitness
 * messages flow only when a profile
 * AND a trainer-approved plan exist
 * (the eligibility engine re-checks
 * immediately before every delivery)
 * — and only when the gym owner
 * enabled daily fitness messages and
 * the member opted in to them.
 */
export function MemberFitnessDialog({
  member,
  open,
  onOpenChange,
  onSaved,
}: MemberFitnessDialogProps) {
  const [goal, setGoal] = useState("")
  const [level, setLevel] = useState<FitnessLevel>("beginner")
  const [notes, setNotes] = useState("")
  const [existingPlanId, setExistingPlanId] = useState<
    string | undefined
  >(undefined)
  const [planName, setPlanName] = useState("")
  const [planDescription, setPlanDescription] = useState("")
  const [exercises, setExercises] = useState("")
  const [trainerName, setTrainerName] = useState("")
  const [approved, setApproved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !member) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void getMemberFitness(member.id)
      .then((fitness) => {
        if (cancelled) return
        setGoal(fitness.profile.goal)
        setLevel(fitness.profile.level)
        setNotes(fitness.profile.notes)
        setExistingPlanId(fitness.plan?.id)
        setPlanName(fitness.plan?.name ?? "")
        setPlanDescription(fitness.plan?.description ?? "")
        setExercises(
          formatExercises(fitness.plan?.exercises ?? [])
        )
        setTrainerName(fitness.plan?.trainerName ?? "")
        setApproved(fitness.plan?.approved ?? false)
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : "The fitness profile failed to load."
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, member])

  const handleSave = async () => {
    if (!member) return
    setSaving(true)
    setError(null)
    try {
      const values: MemberFitnessValues = {
        goal,
        level,
        notes,
        existingPlanId,
        planName,
        planDescription,
        exercises: parseExercises(exercises),
        trainerName,
        approved,
      }
      await saveMemberFitness(member.id, values)
      onSaved?.()
      onOpenChange(false)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The fitness profile could not be saved."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Fitness profile — {member?.name}
          </DialogTitle>
          <DialogDescription>
            Daily fitness messages flow only while this
            profile and a trainer-approved workout plan
            exist — and the member has opted in to daily
            fitness messages.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-4 text-sm text-muted-foreground">
            Loading…
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="member-fitness-goal">
                Fitness goal
              </Label>
              <Input
                id="member-fitness-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. strength, weight loss"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="member-fitness-level">
                Experience level
              </Label>
              <Select
                value={level}
                onValueChange={(value) =>
                  setLevel(value as FitnessLevel)
                }
              >
                <SelectTrigger id="member-fitness-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">
                    Beginner
                  </SelectItem>
                  <SelectItem value="intermediate">
                    Intermediate
                  </SelectItem>
                  <SelectItem value="advanced">
                    Advanced
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="member-fitness-notes">
                Notes
              </Label>
              <Textarea
                id="member-fitness-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Focus areas, preferences"
                className="min-h-[4.5rem]"
              />
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-secondary/30 p-4">
              <p className="text-sm font-medium text-foreground">
                Workout plan
              </p>
              <p className="text-xs text-muted-foreground">
                One approved plan per member — approving a
                new plan archives the previous one. Daily
                messages stop while no plan is approved.
              </p>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="member-plan-name">
                  Plan name
                </Label>
                <Input
                  id="member-plan-name"
                  value={planName}
                  onChange={(e) =>
                    setPlanName(e.target.value)
                  }
                  placeholder="e.g. Starter strength"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="member-plan-description">
                  Description
                </Label>
                <Textarea
                  id="member-plan-description"
                  value={planDescription}
                  onChange={(e) =>
                    setPlanDescription(e.target.value)
                  }
                  placeholder="Weekly structure, intensity"
                  className="min-h-[4.5rem]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="member-plan-exercises">
                  Exercises (comma-separated)
                </Label>
                <Input
                  id="member-plan-exercises"
                  value={exercises}
                  onChange={(e) =>
                    setExercises(e.target.value)
                  }
                  placeholder="Push-ups, Squats, Plank"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="member-plan-trainer">
                  Trainer name
                </Label>
                <Input
                  id="member-plan-trainer"
                  value={trainerName}
                  onChange={(e) =>
                    setTrainerName(e.target.value)
                  }
                  placeholder="Who prepared the plan"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Trainer-approved
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Required for daily fitness messages
                  </p>
                </div>
                <Switch
                  checked={approved}
                  onCheckedChange={setApproved}
                  aria-label="Workout plan approved by trainer"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            Save profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
