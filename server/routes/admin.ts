import { Hono } from 'hono'
import type { AppBindings } from '../env'
import { PROJECT_STATUSES, loginSchema, noteSchema, paymentConfirmSchema, quoteSchema, statusChangeSchema, type ProjectStatus } from '../../shared/domain'
import { ApiError, clientIp, newId, nowIso, ok, parseJson } from '../lib/http'
import { enforceRateLimit } from '../lib/rateLimit'
import { safeEqual, verifyPassword } from '../lib/crypto'
import { signProjectToken } from '../lib/projectToken'
import { createSession, destroySession, loadSession, requireStaff, upsertConfiguredAdmin } from '../middleware/auth'
import { assertTransitionAllowed, requireProject, transition } from '../domain/projects'
import { eventStmt } from '../domain/events'

export const adminRoutes = new Hono<AppBindings>()

// ---------- Auth ----------
adminRoutes.post('/auth/login', async (c) => {
  await enforceRateLimit(c.env.DB, 'login', clientIp(c), 10, 900)
  const { email, password } = await parseJson(c, loginSchema)
  const cfgEmail = (c.env.ADMIN_EMAIL ?? '').trim().toLowerCase()
  const cfgHash = c.env.ADMIN_PASSWORD_HASH ?? ''
  if (!cfgEmail || !cfgHash) throw new ApiError(503, 'NOT_CONFIGURED', 'Akun admin belum dikonfigurasi')
  // Always run the KDF to keep timing similar for wrong emails.
  const passOk = await verifyPassword(password, cfgHash)
  if (!safeEqual(email, cfgEmail) || !passOk) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email atau kata sandi salah')
  const userId = await upsertConfiguredAdmin(c.env.DB, cfgEmail)
  const session = await createSession(c, userId)
  return ok(c, { email: cfgEmail, role: 'admin', csrfToken: session.csrfToken, expiresAt: session.expiresAt })
})

adminRoutes.get('/auth/me', async (c) => {
  const user = await loadSession(c)
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Belum masuk')
  return ok(c, { email: user.email, role: user.role, csrfToken: user.csrfToken })
})

adminRoutes.post('/auth/logout', requireStaff, async (c) => {
  await destroySession(c)
  return ok(c, { loggedOut: true })
})

// ---------- Projects ----------
const admin = new Hono<AppBindings>()
admin.use('*', requireStaff)

admin.get('/projects', async (c) => {
  const status = c.req.query('status')
  const q = (c.req.query('q') ?? '').trim().slice(0, 80)
  const page = Math.max(1, Math.min(1000, Number(c.req.query('page') ?? '1') || 1))
  const pageSize = 20
  if (status && !(PROJECT_STATUSES as readonly string[]).includes(status)) throw new ApiError(422, 'VALIDATION_ERROR', 'Status filter tidak valid')
  const where: string[] = []
  const binds: unknown[] = []
  if (status) { binds.push(status); where.push(`status = ?${binds.length}`) }
  if (q) {
    binds.push(`%${q.replace(/[%_]/g, '')}%`)
    where.push(`(public_reference LIKE ?${binds.length} OR title LIKE ?${binds.length} OR customer_name LIKE ?${binds.length})`)
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const db = c.env.DB
  const total = await db.prepare(`SELECT COUNT(*) AS n FROM projects ${w}`).bind(...binds).first<{ n: number }>()
  const rows = await db
    .prepare(`SELECT id, public_reference, customer_name, service_type, title, status, created_at, updated_at FROM projects ${w} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`)
    .bind(...binds)
    .all()
  const counts = await db.prepare('SELECT status, COUNT(*) AS n FROM projects GROUP BY status').all<{ status: string; n: number }>()
  return ok(c, {
    items: rows.results ?? [],
    page,
    pageSize,
    total: total?.n ?? 0,
    statusCounts: Object.fromEntries((counts.results ?? []).map((r) => [r.status, r.n])),
  })
})

admin.get('/projects/:id', async (c) => {
  const db = c.env.DB
  const p = await requireProject(db, c.req.param('id'))
  const [quotes, payments, feedback, events] = await Promise.all([
    db.prepare('SELECT * FROM quotes WHERE project_id = ?1 ORDER BY created_at DESC').bind(p.id).all(),
    db.prepare('SELECT id, amount_minor, currency, method, provider_reference, status, confirmed_by, confirmed_at, created_at FROM payments WHERE project_id = ?1 ORDER BY created_at DESC').bind(p.id).all(),
    db.prepare('SELECT * FROM feedback WHERE project_id = ?1 ORDER BY created_at DESC').bind(p.id).all(),
    db.prepare(`SELECT e.*, u.email AS actor_email FROM project_events e LEFT JOIN users u ON u.id = e.actor_user_id WHERE e.project_id = ?1 ORDER BY e.created_at DESC`).bind(p.id).all(),
  ])
  const { access_token_version: _v, ...safe } = p
  void _v
  return ok(c, {
    project: { ...safe, brief: JSON.parse(p.brief_json) },
    quotes: (quotes.results ?? []).map((q) => ({ ...q, scope: JSON.parse(String((q as { scope_json: string }).scope_json)) })),
    payments: payments.results ?? [],
    feedback: feedback.results ?? [],
    events: (events.results ?? []).map((e) => ({ ...e, metadata: JSON.parse(String((e as { safe_metadata_json: string }).safe_metadata_json)) })),
  })
})

admin.patch('/projects/:id/status', async (c) => {
  const db = c.env.DB
  const user = c.get('user')!
  const p = await requireProject(db, c.req.param('id'))
  const { toStatus, reason } = await parseJson(c, statusChangeSchema)
  await assertTransitionAllowed(db, p, toStatus as ProjectStatus, reason)
  await transition(db, p, toStatus as ProjectStatus, { type: 'admin', userId: user.id }, reason ? { reason } : {})
  return ok(c, { id: p.id, status: toStatus })
})

admin.post('/projects/:id/quotes', async (c) => {
  const db = c.env.DB
  const user = c.get('user')!
  const p = await requireProject(db, c.req.param('id'))
  if (!['qualifying', 'quoted'].includes(p.status)) throw new ApiError(409, 'INVALID_STATE', 'Penawaran hanya dapat dibuat pada tahap kualifikasi/penawaran')
  const input = await parseJson(c, quoteSchema)
  const id = newId()
  const now = nowIso()
  const stmts = [
    // A newly sent quote supersedes earlier pending ones.
    ...(input.status === 'sent' ? [db.prepare(`UPDATE quotes SET status = 'expired', updated_at = ?2 WHERE project_id = ?1 AND status IN ('draft','sent')`).bind(p.id, now)] : []),
    db
      .prepare(
        `INSERT INTO quotes (id, project_id, currency, amount_minor, scope_json, included_revision_rounds, estimated_delivery_at, status, created_at, updated_at)
         VALUES (?1, ?2, 'IDR', ?3, ?4, ?5, ?6, ?7, ?8, ?8)`,
      )
      .bind(id, p.id, input.amountMinor, JSON.stringify({ deliverables: input.deliverables, notes: input.notes ?? null }), input.includedRevisionRounds, input.estimatedDeliveryAt ?? null, input.status, now),
    eventStmt(db, { projectId: p.id, actorUserId: user.id, actorType: 'admin', eventType: input.status === 'sent' ? 'quote_sent' : 'quote_drafted', metadata: { quoteId: id, amountMinor: input.amountMinor } }),
  ]
  await db.batch(stmts)
  return ok(c, { id, status: input.status }, 201)
})

admin.post('/projects/:id/payments/confirm', async (c) => {
  const db = c.env.DB
  const user = c.get('user')!
  const p = await requireProject(db, c.req.param('id'))
  if (!['quoted', 'awaiting_payment', 'queued', 'producing', 'internal_review', 'customer_review', 'revision', 'approved', 'delivered'].includes(p.status)) {
    throw new ApiError(409, 'INVALID_STATE', 'Pembayaran belum dapat dicatat pada tahap ini')
  }
  const input = await parseJson(c, paymentConfirmSchema)
  const id = newId()
  const now = nowIso()
  await db.batch([
    db
      .prepare(
        `INSERT INTO payments (id, project_id, amount_minor, currency, method, provider_reference, status, confirmed_by, confirmed_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'IDR', ?4, ?5, 'manually_confirmed', ?6, ?7, ?7, ?7)`,
      )
      .bind(id, p.id, input.amountMinor, input.method, input.providerReference ?? null, user.id, now),
    eventStmt(db, { projectId: p.id, actorUserId: user.id, actorType: 'admin', eventType: 'payment_manually_confirmed', metadata: { paymentId: id, amountMinor: input.amountMinor, method: input.method } }),
  ])
  return ok(c, { id, status: 'manually_confirmed' }, 201)
})

admin.post('/projects/:id/events', async (c) => {
  const db = c.env.DB
  const user = c.get('user')!
  const p = await requireProject(db, c.req.param('id'))
  const { note } = await parseJson(c, noteSchema)
  // Internal notes are staff-only; stored as event metadata (never exposed to customer endpoints).
  await eventStmt(db, { projectId: p.id, actorUserId: user.id, actorType: 'admin', eventType: 'internal_note', metadata: { note } }).run()
  return ok(c, { recorded: true }, 201)
})

/** Issue a customer access link. Optionally revoke all previous links first. Token is shown once, never stored. */
admin.post('/projects/:id/access-link', async (c) => {
  const db = c.env.DB
  const user = c.get('user')!
  const secret = c.env.LINK_SIGNING_SECRET
  if (!secret) throw new ApiError(503, 'NOT_CONFIGURED', 'LINK_SIGNING_SECRET belum dikonfigurasi')
  const p = await requireProject(db, c.req.param('id'))
  const revoke = c.req.query('revokePrevious') === 'true'
  let version = p.access_token_version
  if (revoke) {
    version += 1
    await db.prepare('UPDATE projects SET access_token_version = ?1 WHERE id = ?2').bind(version, p.id).run()
  }
  const { token, expiresAt } = await signProjectToken(secret, p.id, version)
  await eventStmt(db, { projectId: p.id, actorUserId: user.id, actorType: 'admin', eventType: revoke ? 'access_link_rotated' : 'access_link_issued', metadata: { expiresAt } }).run()
  const origin = new URL(c.req.url).origin
  return ok(c, { url: `${origin}/p/${p.public_reference}#t=${token}`, expiresAt }, 201)
})

/** Exportable project record (docs/02 FR-10). */
admin.get('/projects/:id/export', async (c) => {
  const db = c.env.DB
  const p = await requireProject(db, c.req.param('id'))
  const [quotes, payments, feedback, events] = await Promise.all(
    ['quotes', 'payments', 'feedback', 'project_events'].map((t) => db.prepare(`SELECT * FROM ${t} WHERE project_id = ?1 ORDER BY created_at ASC`).bind(p.id).all()),
  )
  const { access_token_version: _v, ...safe } = p
  void _v
  c.header('content-disposition', `attachment; filename="${p.public_reference}.json"`)
  return ok(c, { exportedAt: nowIso(), project: { ...safe, brief: JSON.parse(p.brief_json) }, quotes: quotes.results, payments: payments.results, feedback: feedback.results, events: events.results })
})

adminRoutes.route('/', admin)
