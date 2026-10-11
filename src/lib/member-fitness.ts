import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"

/**
 * Member fitness profiles and
 * trainer-approved workout plans.
 *
 * Daily fitness messages flow only when
 * BOTH a fitness profile and an approved,
 * non-archived workout plan exist for the
 * member (the eligibility engine re-checks
 * this immediately before every delivery) —
 * and only when the gym owner enabled
 * daily fitness messages and the member
 * opted in to them.
 *
 * A member has at most one active approved
 * plan: approving a plan archives the
 * member's other approved plans.
 *
 * Remote mode: reads and writes go through
 * RLS (the "gym_owners manage own member
 * fitness profiles / workout plans"
 * policies). Demo mode: reads report an
 * empty profile; mutations are refused.
 */

export type FitnessLevel =
  | "beginner"
  | "intermediate"
  | "advanced"

export interface MemberFitnessProfile {
  goal: string
  level: FitnessLevel
  notes: string
}

export interface MemberWorkoutPlan {
  id: string
  name: string
  description: string
  exercises: string[]
  trainerName: string
  approved: boolean
}

export interface MemberFitness {
  profile: MemberFitnessProfile
  plan: MemberWorkoutPlan | null
}

export interface MemberFitnessValues {
  goal: string
  level: FitnessLevel
  notes: string
  /** The active plan's id when editing
   *  it in place (undefined → a new
   *  plan row). */
  existingPlanId?: string
  planName: string
  planDescription: string
  exercises: string[]
  trainerName: string
  approved: boolean
}

interface FitnessProfileRow {
  goal: string | null
  level: string | null
  notes: string | null
}

interface WorkoutPlanRow {
  id: string
  name: string
  description: string | null
  exercises: unknown
  trainer_name: string | null
  approved: boolean | null
}

function exercisesToList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item))
    : []
}

/**
 * The member's fitness profile and
 * active approved workout plan (null
 * plan when none is approved).
 */
export async function getMemberFitness(
  memberId: string
): Promise<MemberFitness> {
  if (!isSupabaseConfigured()) {
    return {
      profile: { goal: "", level: "beginner", notes: "" },
      plan: null,
    }
  }

  const client = getSupabase()

  const { data: profileData, error: profileError } =
    await client
      .from("fitness_profiles")
      .select("goal, level, notes")
      .eq("member_id", memberId)
      .maybeSingle()
  if (profileError) throw new Error(profileError.message)

  const { data: planData, error: planError } = await client
    .from("workout_plans")
    .select(
      "id, name, description, exercises, trainer_name, approved"
    )
    .eq("member_id", memberId)
    .eq("approved", true)
    .eq("archived", false)
    .limit(1)
    .maybeSingle()
  if (planError) throw new Error(planError.message)

  const profileRow = profileData as FitnessProfileRow | null
  const planRow = planData as WorkoutPlanRow | null

  return {
    profile: {
      goal: profileRow?.goal ?? "",
      level:
        profileRow?.level === "intermediate" ||
        profileRow?.level === "advanced"
          ? profileRow.level
          : "beginner",
      notes: profileRow?.notes ?? "",
    },
    plan: planRow
      ? {
          id: planRow.id,
          name: planRow.name,
          description: planRow.description ?? "",
          exercises: exercisesToList(planRow.exercises),
          trainerName: planRow.trainer_name ?? "",
          approved: Boolean(planRow.approved),
        }
      : null,
  }
}

/**
 * Saves the member's fitness profile and
 * workout plan. An approved plan becomes
 * the member's single active plan (the
 * previous one is archived); saving with
 * an empty plan name archives every plan,
 * which stops the daily messages.
 */
export async function saveMemberFitness(
  memberId: string,
  values: MemberFitnessValues
): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Fitness profiles are not available in demo mode."
    )
  }

  const client = getSupabase()
  const now = new Date().toISOString()

  // The profile — one row per member.
  const { error: profileError } = await client
    .from("fitness_profiles")
    .upsert({
      member_id: memberId,
      goal: values.goal,
      level: values.level,
      notes: values.notes,
      updated_at: now,
    })
  if (profileError) throw new Error(profileError.message)

  const planName = values.planName.trim()

  if (planName === "") {
    // No plan name — archive every plan so
    // the daily messages stop.
    const { error: archiveError } = await client
      .from("workout_plans")
      .update({ archived: true, updated_at: now })
      .eq("member_id", memberId)
    if (archiveError) throw new Error(archiveError.message)
    return
  }

  // At most one active approved plan:
  // archive the member's other approved
  // plans first, then save this one.
  if (values.approved) {
    const { error: archiveError } = await client
      .from("workout_plans")
      .update({ archived: true, updated_at: now })
      .eq("member_id", memberId)
      .eq("approved", true)
      .eq("archived", false)
    if (archiveError) throw new Error(archiveError.message)
  }

  const { error: planError } = await client
    .from("workout_plans")
    .upsert({
      // The existing active plan is
      // updated in place; a new plan
      // gets a fresh id.
      ...(values.existingPlanId
        ? { id: values.existingPlanId }
        : {}),
      member_id: memberId,
      name: planName,
      description: values.planDescription,
      exercises: values.exercises,
      trainer_name: values.trainerName,
      approved: values.approved,
      approved_at: values.approved ? now : null,
      archived: false,
      updated_at: now,
    })
  if (planError) throw new Error(planError.message)
}

/** Splits a comma-separated exercise
 *  list into a clean string array. */
export function parseExercises(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "")
}

/** Joins an exercise list for display
 *  in the edit form. */
export function formatExercises(exercises: string[]): string {
  return exercises.join(", ")
}
