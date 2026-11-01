import type { Env } from '../env'
import { ApiError, newId, nowIso } from '../lib/http'
import { randomBytes, toHex } from '../lib/crypto'
import { checkTransaction, createInvoice, DuitkuError, getDuitkuConfig, type DuitkuConfig } from '../lib/duitku'
import { eventStmt } from './events'
import { getProjectById, transition, type ProjectRow } from './projects'
import { logEvent } from '../lib/log'

export const PAYABLE_STATUSES = ['quoted', 'awaiting_payment'] as const
export const ORDER_EXPIRY_MINUTES = 60

export interface PaymentOrderRow {
  id: string; project_id: string; quote_id: string; provider_env: string; merchant_order_id: string; amount_minor: number
  status: 'created' | 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled'; provider_reference: string | null; payment_url: string | null
  payment_code: string | null; failure_code: string | null; expires_at: string; paid_at: string | null; created_at: string; updated_at: string
}

export function publicOrder(o: PaymentOrderRow) {
  return { id: o.id, merchantOrderId: o.merchant_order_id, amountMinor: o.amount_minor, status: o.status, paymentCode: o.payment_code, expiresAt: o.expires_at, paidAt: o.paid_at, createdAt: o.created_at, environment: o.provider_env }
}

function providerError(e: unknown): never {
  if (e instanceof DuitkuError) {
    logEvent('error', 'duitku_error', { code: e.code, httpStatus: e.httpStatus })
    throw new ApiError(502, 'PAYMENT_PROVIDER_ERROR', `Gateway pembayaran menolak permintaan (${e.code}). Silakan coba lagi atau hubungi kami.`)
  }
  throw e
}

/** Create (or reuse) a Duitku POP invoice for the project's accepted quote. Amount always comes from the server-side quote. */
export async function startCheckout(env: Env, db: D1Database, p: ProjectRow, origin: string, email: string) {
  const cfg = getDuitkuConfig(env)
  if (!cfg) throw new ApiError(409, 'PAYMENTS_DISABLED', 'Pembayaran online belum aktif')
  if (!(PAYABLE_STATUSES as readonly string[]).includes(p.status)) throw new ApiError(409, 'NOT_PAYABLE', 'Proyek ini tidak sedang menunggu pembayaran')
  const q = await db.prepare(`SELECT id, amount_minor, scope_json FROM quotes WHERE project_id = ?1 AND status = 'accepted' ORDER BY accepted_at DESC LIMIT 1`).bind(p.id).first<{ id: string; amount_minor: number }>()
  if (!q || q.amount_minor <= 0) throw new ApiError(409, 'QUOTE_NOT_ACCEPTED', 'Setujui penawaran terlebih dahulu')
  const paid = await db.prepare(`SELECT COUNT(*) n FROM payment_orders WHERE project_id = ?1 AND status = 'paid'`).bind(p.id).first<{ n: number }>()
  if ((paid?.n ?? 0) > 0) throw new ApiError(409, 'ALREADY_PAID', 'Pembayaran untuk proyek ini sudah diterima')

  // Idempotency: reuse a still-valid pending invoice for the same quote and amount.
  const now = nowIso()
  const existing = await db
    .prepare(`SELECT * FROM payment_orders WHERE project_id = ?1 AND quote_id = ?2 AND amount_minor = ?3 AND provider_env = ?4 AND status = 'pending' AND expires_at > ?5 ORDER BY created_at DESC LIMIT 1`)
    .bind(p.id, q.id, q.amount_minor, cfg.env, new Date(Date.now() + 5 * 60_000).toISOString())
    .first<PaymentOrderRow>()
  if (existing?.provider_reference) return { order: existing, reference: existing.provider_reference, cfg, reused: true }

  const id = newId()
  const merchantOrderId = `${p.public_reference}-${toHex(randomBytes(4))}`
  const expiresAt = new Date(Date.now() + ORDER_EXPIRY_MINUTES * 60_000).toISOString()
  await db.batch([
    db.prepare(`INSERT INTO payment_orders (id, project_id, quote_id, provider, provider_env, merchant_order_id, amount_minor, currency, status, expires_at, created_at, updated_at)
                VALUES (?1, ?2, ?3, 'duitku', ?4, ?5, ?6, 'IDR', 'created', ?7, ?8, ?8)`).bind(id, p.id, q.id, cfg.env, merchantOrderId, q.amount_minor, expiresAt, now),
    eventStmt(db, { projectId: p.id, actorType: 'customer', eventType: 'payment_order_created', metadata: { orderId: id, merchantOrderId, amountMinor: q.amount_minor, provider: 'duitku', env: cfg.env } }),
  ])
  let inv: { reference: string; paymentUrl: string }
  try {
    inv = await createInvoice(cfg, {
      merchantOrderId, amount: q.amount_minor, email,
      productDetails: `AVORLUNE ${p.public_reference} — ${p.title}`,
      itemName: `AVORLUNE ${p.public_reference}`,
      customerVaName: p.customer_name.replace(/[^A-Za-z0-9 .'-]/g, '').slice(0, 20) || 'AVORLUNE Client',
      phoneNumber: p.contact_method === 'whatsapp' ? p.customer_contact.replace(/[^\d+]/g, '').slice(0, 20) : undefined,
      callbackUrl: `${origin}/api/v1/payments/duitku/callback`,
      returnUrl: `${origin}/p/${p.public_reference}?payment=return`,
      expiryMinutes: ORDER_EXPIRY_MINUTES,
    })
  } catch (e) {
    await db.prepare(`UPDATE payment_orders SET status = 'failed', failure_code = ?1, updated_at = ?2 WHERE id = ?3 AND status = 'created'`).bind(e instanceof DuitkuError ? e.code : 'ERROR', nowIso(), id).run()
    providerError(e)
  }
  await db.prepare(`UPDATE payment_orders SET status = 'pending', provider_reference = ?1, payment_url = ?2, updated_at = ?3 WHERE id = ?4 AND status = 'created'`).bind(inv.reference, inv.paymentUrl, nowIso(), id).run()
  const order = (await db.prepare('SELECT * FROM payment_orders WHERE id = ?1').bind(id).first<PaymentOrderRow>())!
  return { order, reference: inv.reference, cfg, reused: false }
}

/**
 * Settle an order as paid. Only called after BOTH a valid callback signature (or explicit reconciliation)
 * AND a server-side Duitku transactionStatus = 00 with the exact expected amount. Idempotent.
 */
export async function settlePaid(db: D1Database, order: PaymentOrderRow, info: { reference: string | null; paymentCode?: string | null; publisherOrderId?: string | null }, via: 'callback' | 'reconcile') {
  if (order.status === 'paid') return 'already_paid' as const
  const stamp = nowIso()
  const ref = info.reference ?? order.provider_reference ?? order.merchant_order_id
  const res = await db.batch([
    db.prepare(`UPDATE payment_orders SET status = 'paid', paid_at = ?1, provider_reference = ?2, payment_code = COALESCE(?3, payment_code), publisher_order_id = COALESCE(?4, publisher_order_id), updated_at = ?1
                WHERE id = ?5 AND status != 'paid'`).bind(stamp, ref, info.paymentCode ?? null, info.publisherOrderId ?? null, order.id),
    db.prepare(`INSERT INTO payments (id, project_id, amount_minor, currency, method, provider_reference, status, confirmed_by, confirmed_at, created_at, updated_at)
                SELECT ?1, ?2, ?3, 'IDR', ?4, ?5, 'paid', NULL, ?6, ?6, ?6
                WHERE EXISTS (SELECT 1 FROM payment_orders WHERE id = ?7 AND status = 'paid' AND paid_at = ?6)`).bind(newId(), order.project_id, order.amount_minor, `duitku:${(info.paymentCode ?? 'POP').slice(0, 8)}`, ref, stamp, order.id),
    db.prepare(`INSERT INTO project_events (id, project_id, actor_user_id, actor_type, event_type, from_status, to_status, safe_metadata_json, created_at)
                SELECT ?1, ?2, NULL, 'system', 'payment_gateway_confirmed', NULL, NULL, ?3, ?4
                WHERE EXISTS (SELECT 1 FROM payment_orders WHERE id = ?5 AND status = 'paid' AND paid_at = ?4)`)
      .bind(newId(), order.project_id, JSON.stringify({ orderId: order.id, merchantOrderId: order.merchant_order_id, amountMinor: order.amount_minor, paymentCode: info.paymentCode ?? null, via }), stamp, order.id),
  ])
  if ((res[0].meta.changes ?? 0) !== 1) return 'already_paid' as const
  // Move the project into the production queue if it was waiting for payment.
  const p = await getProjectById(db, order.project_id)
  if (p && (PAYABLE_STATUSES as readonly string[]).includes(p.status)) {
    try {
      await transition(db, p, 'queued', { type: 'system' }, { reason: 'Pembayaran terverifikasi Duitku', orderId: order.id })
    } catch (e) {
      logEvent('warn', 'payment_queue_transition_skipped', { orderId: order.id, message: String((e as Error)?.message ?? e) })
    }
  }
  return 'paid' as const
}

/** Server-to-server reconciliation with Duitku. Never trusts browser-reported results. */
export async function reconcileOrder(env: Env, db: D1Database, order: PaymentOrderRow) {
  if (order.status === 'paid') return { order, outcome: 'already_paid' as const }
  const cfg = getDuitkuConfig(env)
  if (!cfg || cfg.env !== order.provider_env) throw new ApiError(409, 'PAYMENTS_DISABLED', 'Pembayaran online belum aktif')
  let st: Awaited<ReturnType<typeof checkTransaction>>
  try { st = await checkTransaction(cfg, order.merchant_order_id) } catch (e) { providerError(e) }
  const now = nowIso()
  let outcome: 'paid' | 'already_paid' | 'pending' | 'cancelled' | 'expired' | 'amount_mismatch' = 'pending'
  if (st.statusCode === '00') {
    if (st.amount !== order.amount_minor) {
      outcome = 'amount_mismatch'
      logEvent('error', 'duitku_amount_mismatch', { orderId: order.id })
    } else {
      outcome = await settlePaid(db, order, { reference: st.reference }, 'reconcile')
    }
  } else if (st.statusCode === '02') {
    await db.prepare(`UPDATE payment_orders SET status = 'cancelled', failure_code = '02', last_checked_at = ?1, updated_at = ?1 WHERE id = ?2 AND status IN ('created','pending')`).bind(now, order.id).run()
    outcome = 'cancelled'
  } else if (order.expires_at < now) {
    await db.prepare(`UPDATE payment_orders SET status = 'expired', last_checked_at = ?1, updated_at = ?1 WHERE id = ?2 AND status IN ('created','pending')`).bind(now, order.id).run()
    outcome = 'expired'
  } else {
    await db.prepare(`UPDATE payment_orders SET last_checked_at = ?1 WHERE id = ?2`).bind(now, order.id).run()
  }
  const fresh = (await db.prepare('SELECT * FROM payment_orders WHERE id = ?1').bind(order.id).first<PaymentOrderRow>())!
  return { order: fresh, outcome }
}

export async function handleCallback(cfg: DuitkuConfig, db: D1Database, f: Record<string, string>) {
  const { verifyCallbackSignature } = await import('../lib/duitku')
  const merchantOrderId = (f.merchantOrderId ?? '').slice(0, 60)
  const amount = (f.amount ?? '').slice(0, 20)
  const record = (valid: boolean, outcome: string) =>
    db.prepare(`INSERT INTO payment_callbacks (id, merchant_order_id, signature_valid, result_code, amount, provider_reference, outcome, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`)
      .bind(newId(), merchantOrderId || null, valid ? 1 : 0, (f.resultCode ?? '').slice(0, 4) || null, amount || null, (f.reference ?? '').slice(0, 60) || null, outcome, nowIso()).run()

  if (!f.merchantCode || !amount || !merchantOrderId || !f.signature) { await record(false, 'bad_parameter'); return { status: 400 as const, body: 'Bad Parameter' } }
  const valid = await verifyCallbackSignature(cfg, { merchantCode: f.merchantCode, amount, merchantOrderId, signature: f.signature })
  if (!valid) { await record(false, 'bad_signature'); logEvent('warn', 'duitku_callback_bad_signature', {}); return { status: 400 as const, body: 'Bad Signature' } }
  const order = await db.prepare('SELECT * FROM payment_orders WHERE merchant_order_id = ?1').bind(merchantOrderId).first<PaymentOrderRow>()
  if (!order) { await record(true, 'unknown_order'); return { status: 404 as const, body: 'Order Not Found' } }
  if (Math.round(Number(amount)) !== order.amount_minor) { await record(true, 'amount_mismatch'); logEvent('error', 'duitku_callback_amount_mismatch', { orderId: order.id }); return { status: 400 as const, body: 'Amount Mismatch' } }

  if (f.resultCode === '00') {
    // Defence in depth: confirm with Duitku server-to-server before marking paid.
    let st: Awaited<ReturnType<typeof checkTransaction>>
    try { st = await checkTransaction(cfg, merchantOrderId) } catch { await record(true, 'verify_failed'); return { status: 503 as const, body: 'Retry Later' } }
    if (st.statusCode !== '00' || st.amount !== order.amount_minor) { await record(true, `verify_mismatch_${st.statusCode}`); return { status: 409 as const, body: 'Not Confirmed' } }
    const outcome = await settlePaid(db, order, { reference: f.reference || st.reference, paymentCode: f.paymentCode, publisherOrderId: f.publisherOrderId }, 'callback')
    await record(true, outcome)
    return { status: 200 as const, body: 'SUCCESS' }
  }
  if (order.status !== 'paid') {
    await db.prepare(`UPDATE payment_orders SET status = 'failed', failure_code = ?1, updated_at = ?2 WHERE id = ?3 AND status IN ('created','pending')`).bind((f.resultCode ?? '').slice(0, 4), nowIso(), order.id).run()
  }
  await record(true, `result_${(f.resultCode ?? 'x').slice(0, 4)}`)
  return { status: 200 as const, body: 'SUCCESS' }
}
