/**
 * Minimal D1Database shim over node:sqlite for integration tests.
 * Implements the subset used by the app: prepare/bind/first/all/run and transactional batch.
 */
import { createRequire } from 'node:module'
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

type Val = string | number | null | bigint | Uint8Array

// Loaded via require so Vite does not try to resolve the 'node:sqlite' builtin.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type DatabaseSync = DatabaseSyncType

const returnsRows = (sql: string) => /^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql) || /\bRETURNING\b/i.test(sql)

class Stmt {
  constructor(private db: DatabaseSync, public sql: string, private params: Val[] = []) {}
  bind(...values: unknown[]) {
    return new Stmt(this.db, this.sql, values.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : (v as Val))))
  }
  exec() {
    const s = this.db.prepare(this.sql)
    if (returnsRows(this.sql)) {
      const rows = s.all(...this.params) as Record<string, unknown>[]
      return { results: rows, success: true, meta: { changes: rows.length } }
    }
    const r = s.run(...this.params)
    return { results: [], success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
  }
  async first<T>(col?: string): Promise<T | null> {
    const row = (this.exec().results[0] ?? null) as Record<string, unknown> | null
    if (!row) return null
    return (col ? row[col] : row) as T
  }
  async all<T>() {
    return this.exec() as unknown as { results: T[]; success: true; meta: { changes: number } }
  }
  async run() {
    return this.exec()
  }
}

export function createTestD1() {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  const dir = join(process.cwd(), 'migrations')
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) db.exec(readFileSync(join(dir, f), 'utf8'))
  const d1 = {
    prepare: (sql: string) => new Stmt(db, sql),
    async batch(stmts: Stmt[]) {
      db.exec('BEGIN')
      try {
        const out = stmts.map((s) => s.exec())
        db.exec('COMMIT')
        return out
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
    async exec(sql: string) {
      db.exec(sql)
      return { count: 0, duration: 0 }
    },
  }
  return { d1: d1 as unknown as D1Database, raw: db }
}
