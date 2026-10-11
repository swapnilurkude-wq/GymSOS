import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * Stage 8 — the member fitness
 * client (src/lib/member-fitness.ts)
 * against a stub Supabase client.
 */

const mock = vi.hoisted(() => {
  class StubQuery {
    private filters: Array<{ column: string; value: unknown }> = []
    private readonly rows: Record<string, unknown>[]

    constructor(rows: Record<string, unknown>[]) {
      this.rows = rows
    }

    select(_columns?: string) {
      return this
    }

    eq(column: string, value: unknown) {
      this.filters.push({ column, value })
      return this
    }

    limit(_count: number) {
      return this
    }

    maybeSingle() {
      const matching = this.rows.filter((row) =>
        this.filters.every((f) => row[f.column] === f.value)
      )
      return Promise.resolve({
        data: matching[0] ?? null,
        error: null,
      })
    }
  }

  /** Lazy update chain: filters
   *  accumulate, the write applies to
   *  every matching row when awaited. */
  class StubUpdate {
    private filters: Array<{ column: string; value: unknown }> = []
    private readonly rows: Record<string, unknown>[]
    private readonly values: Record<string, unknown>

    constructor(
      rows: Record<string, unknown>[],
      values: Record<string, unknown>
    ) {
      this.rows = rows
      this.values = values
    }

    eq(column: string, value: unknown) {
      this.filters.push({ column, value })
      return this
    }

    then<T>(
      onFulfilled?:
        | ((value: { data: null; error: null }) => T | PromiseLike<T>)
        | null,
      onRejected?: ((reason: unknown) => T | PromiseLike<T>) | null
    ) {
      for (const row of this.rows) {
        if (
          this.filters.every((f) => row[f.column] === f.value)
        ) {
          Object.assign(row, this.values)
        }
      }
      return Promise.resolve({
        data: null,
        error: null,
      }).then(onFulfilled, onRejected)
    }
  }

  class StubClient {
    readonly tables = new Map<string, Record<string, unknown>[]>()
    readonly upserts: Array<{
      table: string
      payload: Record<string, unknown>
    }> = []
    readonly updates: Array<{
      table: string
      values: Record<string, unknown>
    }> = []

    seed(table: string, rows: Record<string, unknown>[]) {
      this.tables.set(table, rows.map((row) => ({ ...row })))
    }

    from(table: string) {
      const rows = this.tables.get(table) ?? []
      const query = new StubQuery(rows)
      return {
        select: (columns?: string) => query.select(columns),
        upsert: (payload: Record<string, unknown>) => {
          this.upserts.push({ table, payload })
          return Promise.resolve({ data: null, error: null })
        },
        update: (values: Record<string, unknown>) => {
          this.updates.push({ table, values })
          return new StubUpdate(rows, values)
        },
      }
    }
  }

  const client = new StubClient()
  return { client, configured: true }
})

vi.mock("@/lib/supabase", () => ({
  SUPABASE_URL: "https://mock.supabase.co",
  SUPABASE_ANON_KEY: "mock-anon-key",
  isSupabaseConfigured: () => mock.configured,
  getSupabase: () => mock.client,
}))

import {
  formatExercises,
  getMemberFitness,
  parseExercises,
  saveMemberFitness,
} from "@/lib/member-fitness"

describe("member fitness client — reads", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    mock.configured = true
    mock.client.upserts.length = 0
    mock.client.updates.length = 0
  })

  it("reads the profile and the active approved plan", async () => {
    mock.client.seed("fitness_profiles", [
      {
        member_id: "member-1",
        goal: "strength",
        level: "intermediate",
        notes: "prefers mornings",
      },
    ])
    mock.client.seed("workout_plans", [
      {
        id: "plan-old",
        member_id: "member-1",
        name: "Old plan",
        description: "superseded",
        exercises: ["Squats"],
        trainer_name: "Trainer",
        approved: true,
        archived: true,
      },
      {
        id: "plan-1",
        member_id: "member-1",
        name: "Starter strength",
        description: "3 days a week",
        exercises: ["Push-ups", "Plank"],
        trainer_name: "Coach",
        approved: true,
        archived: false,
      },
      {
        id: "plan-draft",
        member_id: "member-1",
        name: "Draft",
        description: "",
        exercises: [],
        trainer_name: "",
        approved: false,
        archived: false,
      },
    ])

    const fitness = await getMemberFitness("member-1")

    expect(fitness.profile).toEqual({
      goal: "strength",
      level: "intermediate",
      notes: "prefers mornings",
    })
    // Only the approved, non-archived plan
    // is the active one.
    expect(fitness.plan).toEqual({
      id: "plan-1",
      name: "Starter strength",
      description: "3 days a week",
      exercises: ["Push-ups", "Plank"],
      trainerName: "Coach",
      approved: true,
    })
  })

  it("reports no plan when none is approved", async () => {
    mock.client.seed("fitness_profiles", [])
    mock.client.seed("workout_plans", [
      {
        id: "plan-draft",
        member_id: "member-1",
        name: "Draft",
        description: "",
        exercises: [],
        trainer_name: "",
        approved: false,
        archived: false,
      },
    ])

    const fitness = await getMemberFitness("member-1")

    expect(fitness.plan).toBeNull()
    expect(fitness.profile).toEqual({
      goal: "",
      level: "beginner",
      notes: "",
    })
  })
})

describe("member fitness client — saves", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    mock.configured = true
    mock.client.upserts.length = 0
    mock.client.updates.length = 0
  })

  it("upserts the profile, archives the previous plan, saves in place", async () => {
    mock.client.seed("fitness_profiles", [])
    mock.client.seed("workout_plans", [
      {
        id: "plan-1",
        member_id: "member-1",
        name: "Old plan",
        description: "",
        exercises: [],
        trainer_name: "Coach",
        approved: true,
        archived: false,
      },
    ])

    await saveMemberFitness("member-1", {
      goal: "strength",
      level: "beginner",
      notes: "",
      existingPlanId: "plan-1",
      planName: "New plan",
      planDescription: "4 days a week",
      exercises: ["Push-ups"],
      trainerName: "Coach",
      approved: true,
    })

    // The profile is written first…
    expect(mock.client.upserts[0]).toEqual({
      table: "fitness_profiles",
      payload: expect.objectContaining({
        member_id: "member-1",
        goal: "strength",
        level: "beginner",
      }),
    })
    // …then the previous approved plan is
    // archived (member + approved + active)…
    expect(mock.client.updates[0]).toEqual({
      table: "workout_plans",
      values: expect.objectContaining({ archived: true }),
    })
    expect(
      mock.client.tables.get("workout_plans")![0].archived
    ).toBe(true)
    // …and finally the plan itself is saved
    // in place as the single approved plan.
    expect(mock.client.upserts[1]).toEqual({
      table: "workout_plans",
      payload: expect.objectContaining({
        id: "plan-1",
        member_id: "member-1",
        name: "New plan",
        description: "4 days a week",
        exercises: ["Push-ups"],
        trainer_name: "Coach",
        approved: true,
        archived: false,
      }),
    })
  })

  it("inserts a new plan when there is no existing one", async () => {
    mock.client.seed("fitness_profiles", [])
    mock.client.seed("workout_plans", [])

    await saveMemberFitness("member-1", {
      goal: "",
      level: "beginner",
      notes: "",
      planName: "First plan",
      planDescription: "",
      exercises: [],
      trainerName: "Coach",
      approved: true,
    })

    expect(mock.client.updates).toHaveLength(1)
    expect(mock.client.upserts[1]).toEqual({
      table: "workout_plans",
      payload: expect.objectContaining({
        name: "First plan",
        approved: true,
      }),
    })
    // No id → a fresh plan row.
    expect(
      mock.client.upserts[1].payload.id
    ).toBeUndefined()
  })

  it("archives every plan when the plan name is cleared", async () => {
    mock.client.seed("fitness_profiles", [])
    mock.client.seed("workout_plans", [
      {
        id: "plan-1",
        member_id: "member-1",
        name: "Plan",
        description: "",
        exercises: [],
        trainer_name: "Coach",
        approved: true,
        archived: false,
      },
    ])

    await saveMemberFitness("member-1", {
      goal: "",
      level: "beginner",
      notes: "",
      planName: "   ",
      planDescription: "",
      exercises: [],
      trainerName: "",
      approved: false,
    })

    // The blanket archive runs without the
    // approved-plan filter…
    expect(mock.client.updates[0]).toEqual({
      table: "workout_plans",
      values: { archived: true, updated_at: expect.any(String) },
    })
    expect(
      mock.client.tables.get("workout_plans")![0].archived
    ).toBe(true)
    // …and no plan row is written.
    expect(mock.client.upserts).toHaveLength(1)
    expect(mock.client.upserts[0].table).toBe(
      "fitness_profiles"
    )
  })

  it("refuses to save in demo mode", async () => {
    mock.configured = false

    await expect(
      saveMemberFitness("member-1", {
        goal: "",
        level: "beginner",
        notes: "",
        planName: "Plan",
        planDescription: "",
        exercises: [],
        trainerName: "",
        approved: true,
      })
    ).rejects.toThrow("demo mode")

    expect(mock.client.upserts).toHaveLength(0)
  })

  it("reports an empty profile in demo mode", async () => {
    mock.configured = false

    const fitness = await getMemberFitness("member-1")

    expect(fitness).toEqual({
      profile: { goal: "", level: "beginner", notes: "" },
      plan: null,
    })
  })
})

describe("exercise list helpers", () => {
  it("parses a comma-separated list", () => {
    expect(parseExercises("Push-ups, Squats , , Plank")).toEqual([
      "Push-ups",
      "Squats",
      "Plank",
    ])
    expect(parseExercises("   ")).toEqual([])
  })

  it("joins a list for the edit form", () => {
    expect(formatExercises(["Push-ups", "Plank"])).toBe(
      "Push-ups, Plank"
    )
    expect(formatExercises([])).toBe("")
  })
})
