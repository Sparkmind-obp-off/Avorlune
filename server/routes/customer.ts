import { Hono, type Context } from 'hono'
import type { AppBindings } from '../env'
import { REFERENCE_PATTERN, STATUS_LABELS, feedbackSchema, quoteDecisionSchema } from '../../shared/domain'
import { ApiError, clientIp, newId, nowIso, ok, parseJson } from '../lib/http'
import { enforceRateLimit } from '../lib/rateLimit'
import { verifyProjectToken } from '../lib/projectToken'
import { getProjectByReference, latestQuote, transition, GUARD_SUFFIX, type ProjectRow } from '../domain/projects'
import { eventStmt } from '../domain/events'

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
    actions: {
      canDecideQuote: p.status === 'quoted' && q?.status === 'sent',
      canSubmitFeedback: p.status === 'customer_review',
      canApprove: p.status === 'customer_review',
    },
  })
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

customerRoutes.post('/projects/:reference/approval', async (c) => {
  const p = await authorizeCustomer(c)
  if (p.status !== 'customer_review') throw new ApiError(409, 'NOT_IN_REVIEW', 'Persetujuan hanya dapat diberikan saat tahap review klien')
  await transition(c.env.DB, p, 'approved', { type: 'customer' }, { via: 'customer_link' })
  return ok(c, { status: 'approved' })
})
