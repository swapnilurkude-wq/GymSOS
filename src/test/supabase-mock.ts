/**
 * In-memory Supabase client for tests.
 *
 * Exercises the remote (Supabase) branches of the data layer
 * without a server. Supports the exact query shapes the app
 * uses:
 *
 *   await client.from(t).select("*")                        → { data: Row[] }
 *   await client.from(t).select("*").eq(col, val)           → filtered rows
 *   await client.from(t).select("*").eq(col, val)
 *     .maybeSingle()                                        → { data: Row | null }
 *   await client.from(t).insert(row | rows)
 *   await client.from(t).update(patch).eq(col, val)
 *     .maybeSingle()                                        → updated row | null
 *   await client.from(t).upsert(row | rows)
 *   await client.from(t).delete().eq(col, val)
 *   await client.rpc("bump_receipt_counter", { p_gym_id })  → { data: number }
 */

export type Row = Record<string, unknown>

interface Table {
  rows: Row[]
  primaryKey: string[]
}

const PRIMARY_KEYS: Record<string, string[]> = {
  gyms: ["id"],
  members: ["id"],
  receipts: ["id"],
  profiles: ["id"],
  receipt_counters: ["gym_id"],
  receipt_ledger_counters: ["gym_id"],
  receipt_templates: ["gym_id"],
  notification_preferences: ["user_id"],
  notification_reads: ["user_id", "notification_id"],
}

class MockQueryBuilder {
  private readonly tableName: string
  private readonly tables: Map<string, Table>
  private filters: Array<{ column: string; value: unknown }> = []
  private pendingPatch: Row | null = null
  private pendingDelete = false

  constructor(tableName: string, tables: Map<string, Table>) {
    this.tableName = tableName
    this.tables = tables
  }

  private table(): Table {
    let table = this.tables.get(this.tableName)
    if (!table) {
      table = { rows: [], primaryKey: PRIMARY_KEYS[this.tableName] ?? ["id"] }
      this.tables.set(this.tableName, table)
    }
    return table
  }

  private matching(): Row[] {
    const table = this.tables.get(this.tableName)
    if (!table) return []
    return table.rows.filter((row) =>
      this.filters.every((f) => row[f.column] === f.value)
    )
  }

  private applyPendingPatch(): Row[] {
    if (this.pendingDelete) {
      const table = this.tables.get(this.tableName)
      if (table) {
        const doomed = new Set(this.matching())
        table.rows = table.rows.filter((row) => !doomed.has(row))
      }
      this.pendingDelete = false
      return []
    }
    const matching = this.matching()
    if (this.pendingPatch) {
      for (const row of matching) Object.assign(row, this.pendingPatch)
    }
    return matching
  }

  select(_columns?: string): this {
    return this
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value })
    return this
  }

  insert(payload: Row | Row[]): Promise<{ data: null; error: null }> {
    const rows = Array.isArray(payload) ? payload : [payload]
    this.table().rows.push(...rows.map((row) => ({ ...row })))
    return Promise.resolve({ data: null, error: null })
  }

  update(patch: Row): this {
    this.pendingPatch = { ...patch }
    return this
  }

  upsert(payload: Row | Row[]): Promise<{ data: null; error: null }> {
    const table = this.table()
    const rows = Array.isArray(payload) ? payload : [payload]
    for (const row of rows) {
      const existing = table.rows.find((r) =>
        table.primaryKey.every((key) => r[key] === row[key])
      )
      if (existing) {
        Object.assign(existing, row)
      } else {
        table.rows.push({ ...row })
      }
    }
    return Promise.resolve({ data: null, error: null })
  }

  delete(): this {
    this.pendingDelete = true
    return this
  }

  maybeSingle(): Promise<{ data: Row | null; error: null }> {
    return Promise.resolve({ data: this.applyPendingPatch()[0] ?? null, error: null })
  }

  single(): Promise<{ data: Row | null; error: null }> {
    return this.maybeSingle()
  }

  // Makes the builder awaitable: `await client.from(t).select("*")`
  then<TResult1, TResult2>(
    onFulfilled?:
      | ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const matching = this.applyPendingPatch()
    return Promise.resolve({ data: matching, error: null }).then(
      onFulfilled,
      onRejected
    )
  }
}

export interface SupabaseMock {
  client: {
    from: (table: string) => MockQueryBuilder
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: number; error: null }>
    auth: {
      getSession: () => Promise<{
        data: { session: { access_token: string } | null }
        error: null
      }>
    }
  }
  /** Replace the contents of a table. */
  seedTable(name: string, rows: object[]): void
  /** Current rows of a table (empty when the table was never touched). */
  tableRows(name: string): Row[]
  reset(): void
}

export function createSupabaseMock(): SupabaseMock {
  const tables = new Map<string, Table>()
  const rpcCounts = new Map<string, number>()

  const client: SupabaseMock["client"] = {
    from: (tableName: string) => new MockQueryBuilder(tableName, tables),
    // Mirrors the bump_* SQL functions: an atomic upsert that
    // increments and returns the new value, per gym.
    rpc: (fn: string, args: Record<string, unknown>) => {
      const key = `${fn}:${String(args.p_gym_id ?? "")}`
      const next = (rpcCounts.get(key) ?? 0) + 1
      rpcCounts.set(key, next)
      return Promise.resolve({ data: next, error: null })
    },
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: { access_token: "test-access-token" } },
          error: null,
        }),
    },
  }

  return {
    client,
    seedTable(name: string, rows: object[]) {
      tables.set(name, {
        rows: rows.map((row) => ({ ...row })) as Row[],
        primaryKey: PRIMARY_KEYS[name] ?? ["id"],
      })
    },
    tableRows(name: string): Row[] {
      return [...(tables.get(name)?.rows ?? [])]
    },
    reset() {
      tables.clear()
      rpcCounts.clear()
    },
  }
}
