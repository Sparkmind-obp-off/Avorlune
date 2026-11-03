import { Hono } from 'hono'
import { z } from 'zod'
import type { AppBindings } from '../env'
import { ApiError, newId, nowIso, ok, parseJson } from '../lib/http'
import { requireProject } from '../domain/projects'
import { adminRuns, createRun, createRunSchema, transitionRun, transitionRunSchema } from '../domain/actions'
import { adminCatalogRoutes } from './catalog'

/**
 * Admin platform routes (docs/78 Phases 2, 4, 5): catalog management, CRM / customer 360, action runs.
 * Mounted INSIDE the admin router after requireStaff; the guard below fails closed if ever mounted elsewhere.
 */
export const adminPlatform = new Hono<AppBindings>()
adminPlatform.use('*', async (c, next) => {
  if (!c.get('user')) throw new ApiError(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu')
  await next()
})
adminPlatform.route('/', adminCatalogRoutes)

const uuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v)

// ---------- Action runs ----------
adminPlatform.get('/projects/:id/actions', async (c) => {
  const p = await requireProject(c.env.DB, c.req.param('id'))
  return ok(c, { runs: await adminRuns(c.env.DB, p.id) })
})

adminPlatform.post('/projects/:id/actions', async (c) => {
  const p = await requireProject(c.env.DB, c.req.param('id'))
  const id = await createRun(c.env.DB, p, await parseJson(c, createRunSchema), c.get('user')!.id)
  return ok(c, { id, status: 'draft' }, 201)
})

adminPlatform.post('/projects/:id/actions/:runId/transition', async (c) => {
  const p = await requireProject(c.env.DB, c.req.param('id'))
  const input = await parseJson(c, transitionRunSchema)
  await transitionRun(c.env.DB, p, c.req.param('runId'), input, c.get('user')!.id)
  return ok(c, { id: c.req.param('runId'), status: input.to })
})

// ---------- CRM / customer 360 ----------
const PAGE = 25

/** Bounded search: exact project reference, exact internal customer id, exact (case-insensitive) email, or name prefix. */
adminPlatform.get('/customers', async (c) => {
  const q = (c.req.query('q') ?? '').trim().slice(0, 160)
  const page = Math.max(1, Math.min(200, Number(c.req.query('page') ?? '1') || 1))
  const db = c.env.DB
  let where = '1=1'
  const binds: unknown[] = []
  if (q) {
    if (/^AVL-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(q.toUpperCase())) { where = 'cu.id IN (SELECT customer_id FROM projects WHERE public_reference = ?1)'; binds.push(q.toUpperCase()) }
    else if (uuid(q)) { where = 'cu.id = ?1'; binds.push(q) }
    else if (q.includes('@')) { where = 'cu.email = ?1'; binds.push(q.toLowerCase()) }
    else { where = 'cu.display_name LIKE ?1'; binds.push(`${q.replace(/[%_]/g, '')}%`) }
  }
  const total = await db.prepare(`SELECT COUNT(*) n FROM customers cu WHERE ${where}`).bind(...binds).first<{ n: number }>()
  const rows = await db.prepare(`SELECT cu.id, cu.email, cu.display_name, cu.tags, cu.created_at, cu.last_seen_at,
      (SELECT COUNT(*) FROM projects p WHERE p.customer_id = cu.id) AS project_count
      FROM customers cu WHERE ${where} ORDER BY cu.created_at DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`).bind(...binds).all()
  return ok(c, { items: rows.results ?? [], page, pageSize: PAGE, total: total?.n ?? 0 })
})

adminPlatform.get('/customers/:customerId', async (c) => {
  const id = c.req.param('customerId')
  const db = c.env.DB
  const cu = uuid(id) ? await db.prepare('SELECT id, email, display_name, tags, onboarding_completed_at, onboarding_skipped_at, created_at, last_seen_at FROM customers WHERE id = ?1').bind(id).first() : null
  if (!cu) throw new ApiError(404, 'NOT_FOUND', 'Pelanggan tidak ditemukan')
  const [projects, payments, tickets, runs, notes, timeline] = await Promise.all([
    db.prepare('SELECT id, public_reference, title, service_type, status, created_at, updated_at FROM projects WHERE customer_id = ?1 ORDER BY created_at DESC LIMIT 100').bind(id).all(),
    db.prepare(`SELECT pay.id, p.public_reference, pay.amount_minor, pay.method, pay.status, pay.confirmed_at FROM payments pay JOIN projects p ON p.id = pay.project_id WHERE p.customer_id = ?1 ORDER BY pay.created_at DESC LIMIT 100`).bind(id).all(),
    db.prepare(`SELECT t.id, p.public_reference, t.category, t.status, t.created_at FROM support_tickets t JOIN projects p ON p.id = t.project_id WHERE p.customer_id = ?1 ORDER BY t.created_at DESC LIMIT 100`).bind(id).all(),
    db.prepare(`SELECT r.id, p.public_reference, r.title, r.status, r.updated_at FROM action_runs r JOIN projects p ON p.id = r.project_id WHERE p.customer_id = ?1 ORDER BY r.created_at DESC LIMIT 100`).bind(id).all(),
    db.prepare('SELECT n.id, n.note, n.created_at, u.email AS author FROM customer_notes n LEFT JOIN users u ON u.id = n.created_by WHERE n.customer_id = ?1 ORDER BY n.created_at DESC LIMIT 200').bind(id).all(),
    db.prepare(`SELECT e.event_type, e.to_status, e.actor_type, e.created_at, p.public_reference FROM project_events e JOIN projects p ON p.id = e.project_id
                WHERE p.customer_id = ?1 AND e.event_type != 'internal_note' ORDER BY e.created_at DESC LIMIT 200`).bind(id).all(),
  ])
  return ok(c, { customer: cu, projects: projects.results ?? [], payments: payments.results ?? [], tickets: tickets.results ?? [], actionRuns: runs.results ?? [], notes: notes.results ?? [], timeline: timeline.results ?? [] })
})

const noteSchema = z.object({ note: z.string().trim().min(1).max(2000) })
adminPlatform.post('/customers/:customerId/notes', async (c) => {
  const id = c.req.param('customerId')
  const db = c.env.DB
  const cu = uuid(id) ? await db.prepare('SELECT id FROM customers WHERE id = ?1').bind(id).first() : null
  if (!cu) throw new ApiError(404, 'NOT_FOUND', 'Pelanggan tidak ditemukan')
  const { note } = await parseJson(c, noteSchema)
  const nid = newId()
  const now = nowIso()
  await db.batch([
    db.prepare('INSERT INTO customer_notes (id, customer_id, note, created_by, created_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(nid, id, note, c.get('user')!.id, now),
    db.prepare(`INSERT INTO admin_audit (id, actor_user_id, action, target_type, target_id, metadata_json, created_at) VALUES (?1, ?2, 'customer_note_added', 'customer', ?3, '{}', ?4)`).bind(newId(), c.get('user')!.id, id, now),
  ])
  return ok(c, { id: nid }, 201)
})

const tagsSchema = z.object({ tags: z.array(z.string().trim().regex(/^[a-z0-9-]{2,24}$/)).max(10) })
adminPlatform.patch('/customers/:customerId/tags', async (c) => {
  const id = c.req.param('customerId')
  const { tags } = await parseJson(c, tagsSchema)
  const now = nowIso()
  const r = uuid(id) ? await c.env.DB.prepare('UPDATE customers SET tags = ?1, updated_at = ?2 WHERE id = ?3').bind([...new Set(tags)].join(','), now, id).run() : null
  if (!r || (r.meta.changes ?? 0) !== 1) throw new ApiError(404, 'NOT_FOUND', 'Pelanggan tidak ditemukan')
  await c.env.DB.prepare(`INSERT INTO admin_audit (id, actor_user_id, action, target_type, target_id, metadata_json, created_at) VALUES (?1, ?2, 'customer_tags_set', 'customer', ?3, ?4, ?5)`)
    .bind(newId(), c.get('user')!.id, id, JSON.stringify({ tags }), now).run()
  return ok(c, { id, tags })
})
