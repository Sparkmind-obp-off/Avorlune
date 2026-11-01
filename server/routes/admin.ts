import { Hono } from 'hono'
import type { AppBindings } from '../env'
import { PROJECT_STATUSES, costSchema, loginSchema, noteSchema, paymentConfirmSchema, quoteSchema, statusChangeSchema, type ProjectStatus } from '../../shared/domain'
import { ApiError, clientIp, newId, nowIso, ok, parseJson } from '../lib/http'
import { enforceRateLimit } from '../lib/rateLimit'
import { safeEqual, verifyPassword } from '../lib/crypto'
import { signProjectToken } from '../lib/projectToken'
import { createSession, destroyAllSessions, destroySession, loadSession, requireStaff, upsertConfiguredAdmin } from '../middleware/auth'
import { MAX_ASSET_BYTES, UPLOAD_KINDS, UPLOAD_STATUSES, getProjectAsset, publicAsset, storeAsset, streamAsset, type AssetRow, type UploadKind } from '../domain/assets'
import { deliveryEnabled } from '../domain/assets'
import { logEvent } from '../lib/log'
import { checkoutEnabled, getDuitkuConfig, probeCredentials } from '../lib/duitku'
import { publicOrder, reconcileOrder, type PaymentOrderRow } from '../domain/payments'
import { assertTransitionAllowed, requireProject, transition } from '../domain/projects'
import { eventStmt } from '../domain/events'

export const adminRoutes = new Hono<AppBindings>()

// ---------- Auth ----------
adminRoutes.post('/auth/login', async (c) => {
  // B1 — layered throttling: per trusted client IP, per target account, and a global ceiling
  // so distributed attempts from many IPs are still bounded.
  await enforceRateLimit(c.env.DB, 'login', clientIp(c), 10, 900)
  await enforceRateLimit(c.env.DB, 'login-global', 'all', 100, 900)
  const { email, password } = await parseJson(c, loginSchema)
  await enforceRateLimit(c.env.DB, 'login-account', email, 20, 900)
  const cfgEmail = (c.env.ADMIN_EMAIL ?? '').trim().toLowerCase()
  const cfgHash = c.env.ADMIN_PASSWORD_HASH ?? ''
  if (!cfgEmail || !cfgHash) throw new ApiError(503, 'NOT_CONFIGURED', 'Akun admin belum dikonfigurasi')
  // Always run the KDF to keep timing similar for wrong emails.
  const passOk = await verifyPassword(password, cfgHash)
  if (!safeEqual(email, cfgEmail) || !passOk) {
    logEvent('warn', 'admin_login_failed', { requestId: c.get('requestId') })
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email atau kata sandi salah')
  }
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

/** B1 — revoke every session of this admin (e.g. after a suspected leak or a lost device). */
adminRoutes.post('/auth/logout-all', requireStaff, async (c) => {
  await destroyAllSessions(c, c.get('user')!.id)
  logEvent('info', 'admin_sessions_revoked', { requestId: c.get('requestId') })
  return ok(c, { loggedOut: true, allSessions: true })
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
  const [quotes, payments, feedback, events, assets, costs] = await Promise.all([
    db.prepare('SELECT * FROM quotes WHERE project_id = ?1 ORDER BY created_at DESC').bind(p.id).all(),
    db.prepare('SELECT id, amount_minor, currency, method, provider_reference, status, confirmed_by, confirmed_at, created_at FROM payments WHERE project_id = ?1 ORDER BY created_at DESC').bind(p.id).all(),
    db.prepare('SELECT * FROM feedback WHERE project_id = ?1 ORDER BY created_at DESC').bind(p.id).all(),
    db.prepare(`SELECT e.*, u.email AS actor_email FROM project_events e LEFT JOIN users u ON u.id = e.actor_user_id WHERE e.project_id = ?1 ORDER BY e.created_at DESC LIMIT 500`).bind(p.id).all(),
    db.prepare('SELECT * FROM assets WHERE project_id = ?1 ORDER BY created_at DESC LIMIT 200').bind(p.id).all<AssetRow>(),
    db.prepare('SELECT id, kind, amount_minor, minutes, note, created_at FROM project_costs WHERE project_id = ?1 ORDER BY created_at DESC LIMIT 500').bind(p.id).all<{ kind: string; amount_minor: number; minutes: number }>(),
  ])
  const { access_token_version: _v, ...safe } = p
  void _v
  const costRows = costs.results ?? []
  const revenue = (payments.results as { amount_minor: number; status: string }[] ?? []).filter((x) => ['manually_confirmed', 'paid'].includes(x.status)).reduce((a, b) => a + b.amount_minor, 0)
  const directCost = costRows.filter((x) => x.kind !== 'labor' && x.kind !== 'refund').reduce((a, b) => a + b.amount_minor, 0)
  const refunds = costRows.filter((x) => x.kind === 'refund').reduce((a, b) => a + b.amount_minor, 0)
  const laborCost = costRows.filter((x) => x.kind === 'labor').reduce((a, b) => a + b.amount_minor, 0)
  return ok(c, {
    deliveryEnabled: deliveryEnabled(c.env),
    assets: (assets.results ?? []).map(publicAsset),
    costs: costRows,
    economics: {
      revenueConfirmed: revenue,
      directCost,
      laborCost,
      refunds,
      laborMinutes: costRows.reduce((a, b) => a + b.minutes, 0),
      grossContribution: revenue - refunds - directCost - laborCost,
    },
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
  const { toStatus, reason, assetId } = await parseJson(c, statusChangeSchema)
  await assertTransitionAllowed(db, p, toStatus as ProjectStatus, reason, c.env, assetId)
  const meta: Record<string, unknown> = reason ? { reason } : {}
  if (toStatus === 'approved') meta.assetId = assetId
  await transition(db, p, toStatus as ProjectStatus, { type: 'admin', userId: user.id }, meta, (stamp) =>
    toStatus === 'approved'
      ? [db.prepare(`UPDATE projects SET approved_asset_id = ?1 WHERE id = ?2 AND status = 'approved' AND updated_at = ?3`).bind(assetId, p.id, stamp)]
      : [],
  )
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
  await enforceRateLimit(db, 'export', c.get('user')!.id, 30, 3600)
  const LIMIT = 5000 // bounded export
  const [quotes, payments, feedback, events, assets, costs] = await Promise.all(
    ['quotes', 'payments', 'feedback', 'project_events', 'assets', 'project_costs'].map((t) => db.prepare(`SELECT * FROM ${t} WHERE project_id = ?1 ORDER BY created_at ASC LIMIT ${LIMIT}`).bind(p.id).all()),
  )
  // B3 — audit every export; never include storage keys, token versions or session data.
  await eventStmt(db, { projectId: p.id, actorUserId: c.get('user')!.id, actorType: 'admin', eventType: 'project_exported', metadata: {} }).run()
  const { access_token_version: _v, ...safe } = p
  void _v
  c.header('content-disposition', `attachment; filename="${p.public_reference}.json"`)
  return ok(c, {
    exportedAt: nowIso(),
    limitPerSection: LIMIT,
    project: { ...safe, brief: JSON.parse(p.brief_json) },
    quotes: quotes.results, payments: payments.results, feedback: feedback.results, events: events.results,
    assets: (assets.results as unknown as AssetRow[]).map(publicAsset),
    costs: costs.results,
  })
})

// ---------- A3: private deliverables (enabled only when the DELIVERY_BUCKET bucket is bound) ----------
admin.post('/projects/:id/assets', async (c) => {
  const db = c.env.DB
  const user = c.get('user')!
  const p = await requireProject(db, c.req.param('id'))
  const kind = c.req.query('kind') as UploadKind
  if (!(UPLOAD_KINDS as readonly string[]).includes(kind)) throw new ApiError(422, 'VALIDATION_ERROR', 'kind harus preview atau final')
  if (!(UPLOAD_STATUSES as readonly string[]).includes(p.status)) throw new ApiError(409, 'INVALID_STATE', 'Unggah hanya pada tahap produksi/review/revisi')
  if (!deliveryEnabled(c.env)) throw new ApiError(503, 'DELIVERY_DISABLED', 'Pengiriman file privat belum aktif di lingkungan ini.')
  const declared = Number(c.req.header('content-length') ?? '0')
  if (!declared) throw new ApiError(411, 'LENGTH_REQUIRED', 'Content-Length wajib')
  if (declared > MAX_ASSET_BYTES) throw new ApiError(413, 'FILE_TOO_LARGE', `Ukuran maksimal ${MAX_ASSET_BYTES / 1024 / 1024} MB`)
  const body = new Uint8Array(await c.req.arrayBuffer())
  const filename = (c.req.query('filename') ?? '').slice(0, 120)
  const saved = await storeAsset(c.env, db, p.id, kind, body, filename, user.id)
  await eventStmt(db, { projectId: p.id, actorUserId: user.id, actorType: 'admin', eventType: 'asset_uploaded', metadata: { assetId: saved.id, kind, version: saved.version, sizeBytes: saved.sizeBytes, mimeType: saved.mimeType } }).run()
  return ok(c, saved, 201)
})

admin.get('/projects/:id/assets/:assetId/download', async (c) => {
  const db = c.env.DB
  const p = await requireProject(db, c.req.param('id'))
  const a = await getProjectAsset(db, p.id, c.req.param('assetId'))
  if (!a) throw new ApiError(404, 'NOT_FOUND', 'File tidak tersedia')
  return streamAsset(c.env, a)
})

admin.post('/projects/:id/assets/:assetId/revoke', async (c) => {
  const db = c.env.DB
  const user = c.get('user')!
  const p = await requireProject(db, c.req.param('id'))
  const { note } = await parseJson(c, noteSchema)
  const a = await getProjectAsset(db, p.id, c.req.param('assetId'))
  if (!a || a.status !== 'active') throw new ApiError(404, 'NOT_FOUND', 'File tidak tersedia')
  await db.batch([
    db.prepare(`UPDATE assets SET status = 'revoked', revoked_at = ?1, revoked_by = ?2 WHERE id = ?3 AND project_id = ?4 AND status = 'active'`).bind(nowIso(), user.id, a.id, p.id),
    eventStmt(db, { projectId: p.id, actorUserId: user.id, actorType: 'admin', eventType: 'asset_revoked', metadata: { assetId: a.id, reason: note } }),
  ])
  return ok(c, { id: a.id, status: 'revoked' })
})

// ---------- D4: per-project cost / time ledger ----------
admin.post('/projects/:id/costs', async (c) => {
  const db = c.env.DB
  const user = c.get('user')!
  const p = await requireProject(db, c.req.param('id'))
  const input = await parseJson(c, costSchema)
  const id = newId()
  await db.batch([
    db.prepare('INSERT INTO project_costs (id, project_id, kind, amount_minor, minutes, note, created_by, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
      .bind(id, p.id, input.kind, input.amountMinor, input.minutes, input.note ?? null, user.id, nowIso()),
    eventStmt(db, { projectId: p.id, actorUserId: user.id, actorType: 'admin', eventType: 'cost_recorded', metadata: { costId: id, kind: input.kind, amountMinor: input.amountMinor, minutes: input.minutes } }),
  ])
  return ok(c, { id }, 201)
})

// ---------- Duitku POP ----------
/** Read-only credential/config check (lists active payment methods; creates no transaction). Never returns secrets. */
admin.get('/payments/duitku/status', async (c) => {
  await enforceRateLimit(c.env.DB, 'duitku-probe', c.get('user')!.id, 20, 3600)
  const cfg = getDuitkuConfig(c.env)
  if (!cfg) return ok(c, { configured: false, checkoutEnabled: false })
  const probe = await probeCredentials(cfg)
  return ok(c, {
    configured: true,
    environment: cfg.env,
    merchantCodeMasked: cfg.merchantCode.slice(0, 2) + '***' + cfg.merchantCode.slice(-1),
    checkoutEnabled: checkoutEnabled(c.env),
    credentialsVerified: probe.ok,
    probeError: probe.ok ? null : probe.code,
    methods: probe.ok ? probe.methods : [],
    callbackUrl: `${new URL(c.req.url).origin}/api/v1/payments/duitku/callback`,
  })
})

admin.get('/projects/:id/payment-orders', async (c) => {
  const p = await requireProject(c.env.DB, c.req.param('id'))
  const rows = await c.env.DB.prepare('SELECT * FROM payment_orders WHERE project_id = ?1 ORDER BY created_at DESC LIMIT 50').bind(p.id).all<PaymentOrderRow>()
  const cbs = await c.env.DB.prepare(`SELECT pc.merchant_order_id, pc.signature_valid, pc.result_code, pc.outcome, pc.created_at FROM payment_callbacks pc
    JOIN payment_orders po ON po.merchant_order_id = pc.merchant_order_id WHERE po.project_id = ?1 ORDER BY pc.created_at DESC LIMIT 50`).bind(p.id).all()
  return ok(c, { orders: (rows.results ?? []).map((o) => ({ ...publicOrder(o), failureCode: o.failure_code })), callbacks: cbs.results ?? [] })
})

admin.post('/projects/:id/payment-orders/:orderId/reconcile', async (c) => {
  const db = c.env.DB
  const p = await requireProject(db, c.req.param('id'))
  const id = c.req.param('orderId')
  const o = /^[0-9a-f-]{36}$/i.test(id) ? await db.prepare('SELECT * FROM payment_orders WHERE id = ?1 AND project_id = ?2').bind(id, p.id).first<PaymentOrderRow>() : null
  if (!o) throw new ApiError(404, 'NOT_FOUND', 'Order tidak ditemukan')
  const r = await reconcileOrder(c.env, db, o)
  await eventStmt(db, { projectId: p.id, actorUserId: c.get('user')!.id, actorType: 'admin', eventType: 'payment_reconciled', metadata: { orderId: o.id, outcome: r.outcome } }).run()
  return ok(c, { order: publicOrder(r.order), outcome: r.outcome })
})

adminRoutes.route('/', admin)
