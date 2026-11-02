import { Hono } from 'hono'
import type { AppBindings } from '../env'
import { ApiError, nowIso, ok, parseJson } from '../lib/http'
import { requireRecentAuth } from '../middleware/auth'
import { requireProject } from '../domain/projects'
import { eventStmt } from '../domain/events'
import { emailSendingEnabled, processOutbox } from '../domain/notifications'
import { checkoutEnabled, getDuitkuConfig } from '../lib/duitku'
import { deliveryEnabled } from '../domain/assets'
import {
  createLicense, licenseQaSchema, licenseSchema, providerUpdateSchema, qaLicense, refundRequestSchema, refundResolveSchema,
  requestRefund, resolveRefund, supportResolveSchema,
} from '../domain/operations'

/**
 * Admin operations (docs/54). Mounted INSIDE the admin router, after requireStaff.
 * The guard below is defence in depth: if ever mounted elsewhere, every route fails closed.
 */
export const adminOps = new Hono<AppBindings>()
adminOps.use('*', async (c, next) => {
  if (!c.get('user')) throw new ApiError(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu')
  await next()
})

const uuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v)

// ---------- Dashboard ----------
adminOps.get('/dashboard', async (c) => {
  const db = c.env.DB
  const [byStatus, revenue, refunds, openTickets, pendingNotif, failedNotif, pendingRefunds, pendingOrders, unclearedFinals] = await Promise.all([
    db.prepare('SELECT status, COUNT(*) n FROM projects GROUP BY status').all<{ status: string; n: number }>(),
    db.prepare(`SELECT COALESCE(SUM(amount_minor),0) n FROM payments WHERE status IN ('paid','manually_confirmed','refunded')`).first<{ n: number }>(),
    db.prepare(`SELECT COALESCE(SUM(amount_minor),0) n FROM refunds WHERE status = 'processed'`).first<{ n: number }>(),
    db.prepare(`SELECT COUNT(*) n FROM support_tickets WHERE status = 'open'`).first<{ n: number }>(),
    db.prepare(`SELECT COUNT(*) n FROM notifications WHERE status = 'pending'`).first<{ n: number }>(),
    db.prepare(`SELECT COUNT(*) n FROM notifications WHERE status = 'failed'`).first<{ n: number }>(),
    db.prepare(`SELECT COUNT(*) n FROM refunds WHERE status = 'requested'`).first<{ n: number }>(),
    db.prepare(`SELECT COUNT(*) n FROM payment_orders WHERE status IN ('created','pending')`).first<{ n: number }>(),
    db.prepare(`SELECT COUNT(*) n FROM projects p WHERE p.status = 'approved' AND NOT EXISTS (
                  SELECT 1 FROM asset_licenses l WHERE l.asset_id = p.approved_asset_id AND l.delivery_permitted = 1 AND l.qa_approved_at IS NOT NULL)`).first<{ n: number }>(),
  ])
  return ok(c, {
    projectsByStatus: Object.fromEntries((byStatus.results ?? []).map((r) => [r.status, r.n])),
    revenueConfirmedMinor: revenue?.n ?? 0,
    refundsProcessedMinor: refunds?.n ?? 0,
    openSupportTickets: openTickets?.n ?? 0,
    pendingNotifications: pendingNotif?.n ?? 0,
    failedNotifications: failedNotif?.n ?? 0,
    pendingRefunds: pendingRefunds?.n ?? 0,
    openPaymentOrders: pendingOrders?.n ?? 0,
    approvedAwaitingLicenseClearance: unclearedFinals?.n ?? 0,
    // Configuration flags only — never values.
    settings: {
      environment: c.env.APP_ENV ?? null,
      privateDelivery: deliveryEnabled(c.env),
      duitkuConfigured: getDuitkuConfig(c.env) !== null,
      duitkuEnv: getDuitkuConfig(c.env)?.env ?? null,
      checkoutEnabled: checkoutEnabled(c.env),
      emailSending: emailSendingEnabled(c.env),
    },
  })
})

// ---------- Refunds ----------
adminOps.post('/projects/:id/refunds', async (c) => {
  const p = await requireProject(c.env.DB, c.req.param('id'))
  const id = await requestRefund(c.env.DB, p, await parseJson(c, refundRequestSchema), c.get('user')!.id)
  return ok(c, { id, status: 'requested' }, 201)
})

/** Recording a refund as processed attests that money was returned → step-up auth required. */
adminOps.post('/projects/:id/refunds/:refundId/resolve', requireRecentAuth, async (c) => {
  const p = await requireProject(c.env.DB, c.req.param('id'))
  const input = await parseJson(c, refundResolveSchema)
  await resolveRefund(c.env.DB, p, c.req.param('refundId'), input, c.get('user')!.id)
  return ok(c, { id: c.req.param('refundId'), status: input.decision })
})

// ---------- Asset licensing registry ----------
adminOps.post('/projects/:id/licenses', async (c) => {
  const p = await requireProject(c.env.DB, c.req.param('id'))
  const id = await createLicense(c.env.DB, p, await parseJson(c, licenseSchema), c.get('user')!.id)
  return ok(c, { id }, 201)
})

adminOps.post('/projects/:id/licenses/:licenseId/qa', async (c) => {
  const p = await requireProject(c.env.DB, c.req.param('id'))
  await qaLicense(c.env.DB, p, c.req.param('licenseId'), await parseJson(c, licenseQaSchema), c.get('user')!.id)
  return ok(c, { id: c.req.param('licenseId') })
})

// ---------- Providers ----------
adminOps.get('/providers', async (c) => {
  const rows = await c.env.DB.prepare('SELECT slug, name, kind, terms_url, terms_checked_at, commercial_use, api_available, notes, updated_at FROM providers ORDER BY name').all()
  return ok(c, { providers: rows.results ?? [] })
})

adminOps.patch('/providers/:slug', async (c) => {
  const slug = c.req.param('slug')
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) throw new ApiError(404, 'NOT_FOUND', 'Provider tidak ditemukan')
  const input = await parseJson(c, providerUpdateSchema)
  const r = await c.env.DB.prepare(`UPDATE providers SET terms_url = COALESCE(?1, terms_url), terms_checked_at = COALESCE(?2, terms_checked_at), commercial_use = COALESCE(?3, commercial_use),
      api_available = COALESCE(?4, api_available), notes = COALESCE(?5, notes), updated_by = ?6, updated_at = ?7 WHERE slug = ?8`)
    .bind(input.termsUrl ?? null, input.termsCheckedAt ?? null, input.commercialUse ?? null, input.apiAvailable ?? null, input.notes ?? null, c.get('user')!.id, nowIso(), slug).run()
  if ((r.meta.changes ?? 0) !== 1) throw new ApiError(404, 'NOT_FOUND', 'Provider tidak ditemukan')
  return ok(c, { slug })
})

// ---------- Notifications ----------
adminOps.get('/notifications', async (c) => {
  const status = c.req.query('status') ?? 'pending'
  if (!['pending', 'sent', 'failed', 'manual_sent', 'cancelled'].includes(status)) throw new ApiError(422, 'VALIDATION_ERROR', 'Status tidak dikenal')
  const rows = await c.env.DB.prepare(`SELECT n.id, n.project_id, p.public_reference, n.event, n.channel, n.subject, n.body, n.status, n.attempts, n.last_error, n.created_at, n.sent_at
      FROM notifications n JOIN projects p ON p.id = n.project_id WHERE n.status = ?1 ORDER BY n.created_at DESC LIMIT 100`).bind(status).all()
  return ok(c, { emailSending: emailSendingEnabled(c.env), notifications: rows.results ?? [] })
})

adminOps.post('/notifications/process', async (c) => ok(c, await processOutbox(c.env, c.env.DB)))

adminOps.post('/notifications/:id/:action', async (c) => {
  const id = c.req.param('id')
  const action = c.req.param('action')
  if (!uuid(id) || !['manual-sent', 'cancel', 'retry'].includes(action)) throw new ApiError(404, 'NOT_FOUND', 'Notifikasi tidak ditemukan')
  const db = c.env.DB
  const n = await db.prepare('SELECT id, project_id, status, event FROM notifications WHERE id = ?1').bind(id).first<{ id: string; project_id: string; status: string; event: string }>()
  if (!n) throw new ApiError(404, 'NOT_FOUND', 'Notifikasi tidak ditemukan')
  const allowed = action === 'retry' ? ['failed'] : ['pending', 'failed']
  if (!allowed.includes(n.status)) throw new ApiError(409, 'INVALID_STATE', 'Status notifikasi tidak dapat diubah')
  const now = nowIso()
  const next = action === 'manual-sent' ? 'manual_sent' : action === 'cancel' ? 'cancelled' : 'pending'
  await db.batch([
    db.prepare(`UPDATE notifications SET status = ?1, sent_at = CASE WHEN ?1 = 'manual_sent' THEN ?2 ELSE sent_at END, sent_by = CASE WHEN ?1 = 'manual_sent' THEN ?3 ELSE sent_by END,
                attempts = CASE WHEN ?1 = 'pending' THEN 0 ELSE attempts END, next_attempt_at = CASE WHEN ?1 = 'pending' THEN ?2 ELSE next_attempt_at END, updated_at = ?2 WHERE id = ?4`)
      .bind(next, now, c.get('user')!.id, id),
    eventStmt(db, { projectId: n.project_id, actorUserId: c.get('user')!.id, actorType: 'admin', eventType: `notification_${next}`, metadata: { notificationId: id, event: n.event } }),
  ])
  return ok(c, { id, status: next })
})

// ---------- Support tickets ----------
adminOps.get('/support', async (c) => {
  const status = c.req.query('status') ?? 'open'
  if (!['open', 'resolved'].includes(status)) throw new ApiError(422, 'VALIDATION_ERROR', 'Status tidak dikenal')
  const rows = await c.env.DB.prepare(`SELECT t.id, t.project_id, p.public_reference, p.title, t.category, t.message, t.status, t.resolution_note, t.created_at, t.resolved_at
      FROM support_tickets t JOIN projects p ON p.id = t.project_id WHERE t.status = ?1 ORDER BY t.created_at DESC LIMIT 100`).bind(status).all()
  return ok(c, { tickets: rows.results ?? [] })
})

adminOps.post('/support/:id/resolve', async (c) => {
  const id = c.req.param('id')
  if (!uuid(id)) throw new ApiError(404, 'NOT_FOUND', 'Tiket tidak ditemukan')
  const { note } = await parseJson(c, supportResolveSchema)
  const db = c.env.DB
  const t = await db.prepare(`SELECT id, project_id FROM support_tickets WHERE id = ?1 AND status = 'open'`).bind(id).first<{ id: string; project_id: string }>()
  if (!t) throw new ApiError(404, 'NOT_FOUND', 'Tiket tidak ditemukan atau sudah selesai')
  const now = nowIso()
  await db.batch([
    db.prepare(`UPDATE support_tickets SET status = 'resolved', resolution_note = ?1, resolved_by = ?2, resolved_at = ?3 WHERE id = ?4 AND status = 'open'`).bind(note, c.get('user')!.id, now, id),
    eventStmt(db, { projectId: t.project_id, actorUserId: c.get('user')!.id, actorType: 'admin', eventType: 'support_resolved', metadata: { ticketId: id } }),
  ])
  return ok(c, { id, status: 'resolved' })
})
