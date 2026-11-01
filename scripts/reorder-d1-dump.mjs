// Usage: node scripts/reorder-d1-dump.mjs <in.sql> <out.sql>
// `wrangler d1 export` emits CREATE TABLE + INSERTs per table in creation order. When a later
// migration adds a FK to a table created afterwards (projects.approved_asset_id -> assets), a raw
// restore into an EMPTY database fails ("no such table: main.assets"). This reorders the dump into:
// PRAGMAs -> all CREATE TABLE -> all INSERT -> CREATE INDEX/TRIGGER/VIEW. Statement text is untouched.
import { readFileSync, writeFileSync } from 'node:fs'

const [, , input, output] = process.argv
if (!input || !output) { console.error('usage: reorder-d1-dump.mjs <in.sql> <out.sql>'); process.exit(1) }
const sql = readFileSync(input, 'utf8')

// Split on statement-terminating semicolons outside single-quoted strings.
const stmts = []
let cur = '', inStr = false
for (let i = 0; i < sql.length; i++) {
  const ch = sql[i]
  cur += ch
  if (ch === "'") { if (inStr && sql[i + 1] === "'") { cur += sql[++i]; continue } inStr = !inStr }
  else if (ch === ';' && !inStr) { if (cur.trim()) stmts.push(cur.trim()); cur = '' }
}
if (cur.trim()) stmts.push(cur.trim())

const groups = { pragma: [], table: [], insert: [], other: [] }
for (const s of stmts) {
  const u = s.replace(/^\s+/, '').toUpperCase()
  if (u.startsWith('PRAGMA')) groups.pragma.push(s)
  else if (u.startsWith('CREATE TABLE')) groups.table.push(s)
  else if (u.startsWith('INSERT')) groups.insert.push(s)
  else groups.other.push(s)
}
const out = [...groups.pragma, ...groups.table, ...groups.insert, ...groups.other].join('\n') + '\n'
writeFileSync(output, out)
console.log(JSON.stringify({ statements: stmts.length, tables: groups.table.length, inserts: groups.insert.length, other: groups.other.length }))
