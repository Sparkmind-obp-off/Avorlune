import { Hono, type Context } from 'hono'
import type { AppBindings } from '../env'
import { REFERENCE_PATTERN, STATUS_LABELS, feedbackSchema, quoteDecisionSchema } from '../../shared/domain'
import { ApiError, clientIp, newId, nowIso, ok, parseJson } from '../lib/http'
import { enforceRateLimit } from '../lib/rateLimit'
import { verifyProjectToken } from '../lib/projectToken'
import { getProjectByReference, latestQuote, transition, GUARD_SUFFIX, type ProjectRow } from '../domain/projects'
import { CUSTOMER_VISIBLE_STATUSES, assertValidFinalAsset, getProjectAsset, hasValidFinalAsset, publicAsset, streamAsset, type AssetRow } from '../domain/assets'
import { deliveryEnabled } from '../domain/assets'
import { z } from 'zod'
import { checkoutEnabled, getDuitkuConfig } from '../lib/duitku'
import { publicOrder, reconcileOrder, startCheckout, type PaymentOrderRow } from '../domain/payments'
import { eventStmt } from '../domain/events'
import { notificationStmt } from '../domain/notifications'
import { supportSchema } from '../domain/operations'

export const customerRoutes = new Hono<AppBindings>()

const notFound = () => new ApiError(404, 'NOT_FOUND', 'Proyek tidak ditemukan atau tautan akses tidak berlaku')

/** Customer access = reference + valid, unexpired, unrevoked HMAC token bound to that project. Failures are indistinguishable. */
async function authorizeCustomer(c: Context<AppBindings>): Promise<ProjectRow> {
  await enforceRateLimit(c.env.DB, 'customer', clientIp(c), 60, 60)
  const ref = c.req.param('reference') ?? ''
  const token = c.req.header('x-project-token') ?? ''
  const secret = c.env.LINK_SIGNING_SECRET
  if (!secret) throw new ApiError(503, 'NOT_CONFIGURED', 'Akses proyek belum dikonfigurasi')
  if (!REFERENCE_PATTERN.test(ref) || !token) throw notFound()
  const claims = await verifyProjectToken(secret, token)
  if (!claims) throw notFound()
  const p = await getProjectByReference(c.env.DB, ref)
  if (!p || p.id !== claims.projectId || p.access_token_version !== claims.version) throw notFound()
  return p
}

customerRoutes.get('/projects/:reference', async (c) => {
  const p = await authorizeCustomer(c)
  const db = c.env.DB
  const q = await latestQuote(db, p.id)
  const events = await db
    .prepare(`SELECT to_status, created_at FROM project_events WHERE project_id = ?1 AND event_type IN ('status_changed','inquiry_created') ORDER BY created_at ASC`)
    .bind(p.id)
    .all<{ to_status: string; created_at: string }>()
  const fb = await db
    .prepare(`SELECT id, message, revision_round, within_scope, status, created_at FROM feedback WHERE project_id = ?1 AND submitted_via = 'customer_link' ORDER BY created_at ASC`)
    .bind(p.id)
    .all()
  const scope = q ? (JSON.parse(q.scope_json) as { deliverables: string[]; notes?: string }) : null
  return ok(c, {
    reference: p.public_reference,
    title: p.title,
    serviceType: p.service_type,
    status: p.status,
    statusLabel: STATUS_LABELS[p.status],
    createdAt: p.created_at,
    revisionRoundsUsed: p.revision_rounds_used,
    quote: q
      ? {
          id: q.id,
          status: q.status,
          amountMinor: q.amount_minor,
          currency: q.currency,
          deliverables: scope?.deliverables ?? [],
          notes: scope?.notes ?? null,
          includedRevisionRounds: q.included_revision_rounds,
          estimatedDeliveryAt: q.estimated_delivery_at,
        }
      : null,
    timeline: (events.results ?? []).map((e) => ({ status: e.to_status, label: STATUS_LABELS[e.to_status as keyof typeof STATUS_LABELS] ?? e.to_status, at: e.created_at })),
    feedback: fb.results ?? [],
    deliveryEnabled: deliveryEnabled(c.env),
    payment: await customerPayment(c.env, db, p),
    support: ((await db.prepare(`SELECT id, category, status, created_at, resolved_at, resolution_note FROM support_tickets WHERE project_id = ?1 ORDER BY created_at DESC LIMIT 20`).bind(p.id).all()).results ?? []),
    refunds: ((await db.prepare(`SELECT id, amount_minor, status, created_at, resolved_at FROM refunds WHERE project_id = ?1 ORDER BY created_at DESC LIMIT 20`).bind(p.id).all()).results ?? []),
    assets: await customerAssets(deliveryEnabled(c.env) ? db : null, p),
    approvedAssetId: p.approved_asset_id ?? null,
    actions: {
      canDecideQuote: p.status === 'quoted' && q?.status === 'sent',
      canSubmitFeedback: p.status === 'customer_review',
      // A2: approval is offered only when a valid private final deliverable exists.
      canApprove: p.status === 'customer_review' && (await hasValidFinalAsset(c.env, db, p.id)),
    },
  })
})

async function customerPayment(env: AppBindings['Bindings'], db: D1Database, p: ProjectRow) {
  const orders = await db.prepare('SELECT * FROM payment_orders WHERE project_id = ?1 ORDER BY created_at DESC LIMIT 5').bind(p.id).all<PaymentOrderRow>()
  const accepted = await db.prepare(`SELECT COUNT(*) n FROM quotes WHERE project_id = ?1 AND status = 'accepted'`).bind(p.id).first<{ n: number }>()
  const list = orders.results ?? []
  const paid = list.some((o) => o.status === 'paid')
  return {
    onlineEnabled: checkoutEnabled(env),
    canPay: checkoutEnabled(env) && !paid && (accepted?.n ?? 0) > 0 && ['quoted', 'awaiting_payment'].includes(p.status),
    needsEmail: p.contact_method !== 'email',
    orders: list.map(publicOrder),
  }
}

async function customerAssets(db: D1Database | null, p: ProjectRow) {
  if (!db || !(CUSTOMER_VISIBLE_STATUSES as readonly string[]).includes(p.status)) return []
  const rows = await db
    .prepare(`SELECT * FROM assets WHERE project_id = ?1 AND status = 'active' AND asset_kind IN ('preview','final') ORDER BY created_at DESC LIMIT 100`)
    .bind(p.id)
    .all<AssetRow>()
  return (rows.results ?? []).map(publicAsset)
}

/** Authorized download (token in header, never in URL). Object keys are never exposed. */
customerRoutes.get('/projects/:reference/assets/:assetId/download', async (c) => {
  const p = await authorizeCustomer(c)
  if (!(CUSTOMER_VISIBLE_STATUSES as readonly string[]).includes(p.status)) throw notFound()
  const a = await getProjectAsset(c.env.DB, p.id, c.req.param('assetId'))
  if (!a || a.status !== 'active' || !['preview', 'final'].includes(a.asset_kind)) throw new ApiError(404, 'NOT_FOUND', 'File tidak tersedia')
  const res = await streamAsset(c.env, a)
  await eventStmt(c.env.DB, { projectId: p.id, actorType: 'customer', eventType: 'asset_downloaded', metadata: { assetId: a.id, kind: a.asset_kind } }).run()
  return res
})

customerRoutes.post('/projects/:reference/quote/decision', async (c) => {
  const p = await authorizeCustomer(c)
  const { decision } = await parseJson(c, quoteDecisionSchema)
  const db = c.env.DB
  const q = await latestQuote(db, p.id)
  if (p.status !== 'quoted' || !q || q.status !== 'sent') throw new ApiError(409, 'NO_PENDING_QUOTE', 'Tidak ada penawaran yang menunggu keputusan')
  const now = nowIso()
  const res = await db.batch([
    db.prepare(`UPDATE quotes SET status = ?1, accepted_at = ?2, updated_at = ?3 WHERE id = ?4 AND status = 'sent'`).bind(decision, decision === 'accepted' ? now : null, now, q.id),
    eventStmt(db, { projectId: p.id, actorType: 'customer', eventType: `quote_${decision}`, metadata: { quoteId: q.id } }),
    ...(decision === 'accepted' ? [notificationStmt(db, p, 'quote_accepted', q.id, q.amount_minor)] : []),
  ])
  if ((res[0].meta.changes ?? 0) !== 1) throw new ApiError(409, 'STALE_STATE', 'Penawaran sudah diputuskan')
  return ok(c, { quoteId: q.id, status: decision })
})

customerRoutes.post('/projects/:reference/feedback', async (c) => {
  const p = await authorizeCustomer(c)
  const { message } = await parseJson(c, feedbackSchema)
  if (p.status !== 'customer_review') throw new ApiError(409, 'NOT_IN_REVIEW', 'Feedback hanya dapat dikirim saat tahap review klien')
  const db = c.env.DB
  const q = await latestQuote(db, p.id)
  const round = p.revision_rounds_used + 1
  const included = q?.status === 'accepted' ? q.included_revision_rounds : 0
  const withinScope = round <= included ? 1 : 0
  const feedbackId = newId()
  await transition(db, p, 'revision', { type: 'customer' }, { revisionRound: round, withinScope: !!withinScope }, (stamp) => [
    db
      .prepare(
        `INSERT INTO feedback (id, project_id, submitted_via, message, revision_round, within_scope, status, created_at)
         SELECT ?1, ?2, 'customer_link', ?3, ?4, ?5, 'open', ?6` + GUARD_SUFFIX(7),
      )
      .bind(feedbackId, p.id, message, round, withinScope, stamp, p.id, 'revision', stamp),
    db.prepare(`UPDATE projects SET revision_rounds_used = ?1 WHERE id = ?2 AND status = 'revision' AND updated_at = ?3`).bind(round, p.id, stamp),
  ])
  return ok(c, { feedbackId, revisionRound: round, withinScope: !!withinScope }, 201)
})

const approvalSchema = z.object({ assetId: z.string().uuid() })

/**
 * A2 — final approval is bound to one specific, valid, private final asset of THIS project.
 * Repeat approvals are rejected (project no longer in customer_review).
 */
customerRoutes.post('/projects/:reference/approval', async (c) => {
  const p = await authorizeCustomer(c)
  if (p.status !== 'customer_review') throw new ApiError(409, 'NOT_IN_REVIEW', 'Persetujuan hanya dapat diberikan saat tahap review klien')
  if (!deliveryEnabled(c.env)) throw new ApiError(409, 'DELIVERY_UNAVAILABLE', 'Persetujuan akhir dinonaktifkan sampai pengiriman file privat aktif.')
  const { assetId } = await parseJson(c, approvalSchema)
  const db = c.env.DB
  const a = await assertValidFinalAsset(c.env, db, p.id, assetId)
  await transition(db, p, 'approved', { type: 'customer' }, { via: 'customer_link', assetId: a.id, assetVersion: a.version, checksum: a.checksum }, (stamp) => [
    db.prepare(`UPDATE projects SET approved_asset_id = ?1 WHERE id = ?2 AND status = 'approved' AND updated_at = ?3`).bind(a.id, p.id, stamp),
  ])
  return ok(c, { status: 'approved', assetId: a.id })
})

const checkoutSchema = z.object({ email: z.string().trim().toLowerCase().email().max(160).optional() })

/** Start (or reuse) a Duitku POP checkout. Amount is taken from the accepted quote on the server — never from the client. */
customerRoutes.post('/projects/:reference/payments/checkout', async (c) => {
  const p = await authorizeCustomer(c)
  await enforceRateLimit(c.env.DB, 'checkout', p.id, 10, 3600)
  if (!checkoutEnabled(c.env)) throw new ApiError(409, 'PAYMENTS_DISABLED', 'Pembayaran online belum aktif. Tim kami akan mengirim instruksi pembayaran manual.')
  const { email } = await parseJson(c, checkoutSchema)
  const contactEmail = p.contact_method === 'email' ? p.customer_contact : email
  if (!contactEmail) throw new ApiError(422, 'EMAIL_REQUIRED', 'Email wajib untuk tanda terima pembayaran')
  const r = await startCheckout(c.env, c.env.DB, p, new URL(c.req.url).origin, contactEmail)
  return ok(c, { order: publicOrder(r.order), reference: r.reference, popScript: r.cfg.endpoints.popScript, paymentUrl: r.order.payment_url, reused: r.reused }, r.reused ? 200 : 201)
})

/** Server-to-server status check; the browser's POP result is only a hint to call this. */
customerRoutes.post('/projects/:reference/payments/:orderId/refresh', async (c) => {
  const p = await authorizeCustomer(c)
  await enforceRateLimit(c.env.DB, 'pay-refresh', p.id, 30, 600)
  if (!getDuitkuConfig(c.env)) throw new ApiError(409, 'PAYMENTS_DISABLED', 'Pembayaran online belum aktif')
  const id = c.req.param('orderId')
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'NOT_FOUND', 'Order tidak ditemukan')
  const o = await c.env.DB.prepare('SELECT * FROM payment_orders WHERE id = ?1 AND project_id = ?2').bind(id, p.id).first<PaymentOrderRow>()
  if (!o) throw new ApiError(404, 'NOT_FOUND', 'Order tidak ditemukan')
  const r = await reconcileOrder(c.env, c.env.DB, o)
  return ok(c, { order: publicOrder(r.order), outcome: r.outcome })
})

/** Customer support / issue reporting. Bounded per project; message is never echoed to other projects. */
customerRoutes.post('/projects/:reference/support', async (c) => {
  const p = await authorizeCustomer(c)
  await enforceRateLimit(c.env.DB, 'support', p.id, 5, 3600)
  const input = await parseJson(c, supportSchema)
  const id = newId()
  const now = nowIso()
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO support_tickets (id, project_id, category, message, status, created_at) VALUES (?1, ?2, ?3, ?4, 'open', ?5)`).bind(id, p.id, input.category, input.message, now),
    eventStmt(c.env.DB, { projectId: p.id, actorType: 'customer', eventType: 'support_opened', metadata: { ticketId: id, category: input.category } }),
  ])
  return ok(c, { id, status: 'open' }, 201)
})
