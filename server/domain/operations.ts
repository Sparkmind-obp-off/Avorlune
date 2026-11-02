import { z } from 'zod'
import { ApiError, newId, nowIso } from '../lib/http'
import { eventStmt } from './events'
import { notificationStmt } from './notifications'
import type { ProjectRow } from './projects'

// ---------- Refunds (manual, auditable — docs/54 §2) ----------
export const REFUND_CHANNELS = ['duitku_portal', 'bank_transfer', 'other'] as const
export const refundRequestSchema = z.object({
  paymentId: z.string().uuid(),
  amountMinor: z.number().int().min(1).max(10_000_000_000),
  reason: z.string().trim().min(5).max(1000),
  channel: z.enum(REFUND_CHANNELS),
})
export const refundResolveSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('processed'), providerReference: z.string().trim().min(3).max(120), note: z.string().trim().max(1000).optional() }),
  z.object({ decision: z.literal('rejected'), note: z.string().trim().min(5).max(1000) }),
])

interface PaymentRow { id: string; project_id: string; amount_minor: number; status: string }
export interface RefundRow { id: string; project_id: string; payment_id: string; amount_minor: number; reason: string; status: string; channel: string; provider_reference: string | null; resolution_note: string | null; created_at: string; resolved_at: string | null }

/** Amount still refundable on a payment = paid amount − processed − open requests. */
export async function refundableAmount(db: D1Database, payment: PaymentRow) {
  const r = await db.prepare(`SELECT COALESCE(SUM(amount_minor), 0) AS n FROM refunds WHERE payment_id = ?1 AND status IN ('requested','processed')`).bind(payment.id).first<{ n: number }>()
  return payment.amount_minor - (r?.n ?? 0)
}

export async function requestRefund(db: D1Database, p: ProjectRow, input: z.infer<typeof refundRequestSchema>, actorId: string) {
  const pay = await db.prepare('SELECT id, project_id, amount_minor, status FROM payments WHERE id = ?1 AND project_id = ?2').bind(input.paymentId, p.id).first<PaymentRow>()
  if (!pay) throw new ApiError(404, 'NOT_FOUND', 'Pembayaran tidak ditemukan')
  if (!['paid', 'manually_confirmed'].includes(pay.status)) throw new ApiError(409, 'NOT_REFUNDABLE', 'Pembayaran ini tidak dapat direfund')
  const left = await refundableAmount(db, pay)
  if (input.amountMinor > left) throw new ApiError(409, 'REFUND_EXCEEDS_PAYMENT', 'Jumlah refund melebihi sisa pembayaran yang dapat direfund')
  const id = newId()
  const now = nowIso()
  await db.batch([
    db.prepare(`INSERT INTO refunds (id, project_id, payment_id, amount_minor, reason, status, channel, requested_by, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, 'requested', ?6, ?7, ?8, ?8)`)
      .bind(id, p.id, pay.id, input.amountMinor, input.reason, input.channel, actorId, now),
    eventStmt(db, { projectId: p.id, actorUserId: actorId, actorType: 'admin', eventType: 'refund_requested', metadata: { refundId: id, paymentId: pay.id, amountMinor: input.amountMinor, channel: input.channel } }),
  ])
  return id
}

export async function resolveRefund(db: D1Database, p: ProjectRow, refundId: string, input: z.infer<typeof refundResolveSchema>, actorId: string) {
  const r = /^[0-9a-f-]{36}$/i.test(refundId) ? await db.prepare('SELECT * FROM refunds WHERE id = ?1 AND project_id = ?2').bind(refundId, p.id).first<RefundRow>() : null
  if (!r) throw new ApiError(404, 'NOT_FOUND', 'Refund tidak ditemukan')
  if (r.status !== 'requested') throw new ApiError(409, 'ALREADY_RESOLVED', 'Refund sudah diputuskan')
  const now = nowIso()
  const stmts: D1PreparedStatement[] = [
    db.prepare(`UPDATE refunds SET status = ?1, provider_reference = ?2, resolution_note = ?3, resolved_by = ?4, resolved_at = ?5, updated_at = ?5 WHERE id = ?6 AND status = 'requested'`)
      .bind(input.decision, input.decision === 'processed' ? input.providerReference : null, input.note ?? null, actorId, now, r.id),
    eventStmt(db, { projectId: p.id, actorUserId: actorId, actorType: 'admin', eventType: input.decision === 'processed' ? 'refund_processed' : 'refund_rejected', metadata: { refundId: r.id, paymentId: r.payment_id, amountMinor: r.amount_minor } }),
    notificationStmt(db, p, input.decision === 'processed' ? 'refund_processed' : 'refund_rejected', r.id, r.amount_minor),
  ]
  if (input.decision === 'processed') {
    // Payment becomes 'refunded' once processed refunds cover its full amount.
    stmts.push(db.prepare(`UPDATE payments SET status = 'refunded', updated_at = ?1 WHERE id = ?2 AND amount_minor <= (SELECT COALESCE(SUM(amount_minor),0) FROM refunds WHERE payment_id = ?2 AND status = 'processed')`).bind(now, r.payment_id))
  }
  const res = await db.batch(stmts)
  if ((res[0].meta.changes ?? 0) !== 1) throw new ApiError(409, 'ALREADY_RESOLVED', 'Refund sudah diputuskan')
}

// ---------- Asset licensing registry (docs/54 §4) ----------
export const SOURCE_TYPES = ['customer_provided', 'ai_generated', 'licensed_stock', 'avorlune_original', 'third_party'] as const
export const COMMERCIAL_USE = ['unverified', 'allowed', 'restricted', 'not_allowed'] as const
const opt = (max: number) => z.string().trim().max(max).optional()
export const licenseSchema = z.object({
  assetId: z.string().uuid().optional(),
  sourceType: z.enum(SOURCE_TYPES),
  providerSlug: z.string().trim().regex(/^[a-z0-9-]{2,40}$/).optional(),
  providerReference: opt(200),
  generationNotes: opt(4000),
  sourceMaterial: opt(1000),
  licenseName: opt(200),
  licenseEvidence: opt(1000),
  commercialUse: z.enum(COMMERCIAL_USE),
  restrictions: opt(1000),
})
export const licenseQaSchema = z.object({ deliveryPermitted: z.boolean(), note: z.string().trim().max(500).optional() })

export interface LicenseRow { id: string; project_id: string; asset_id: string | null; source_type: string; provider_slug: string | null; commercial_use: string; license_evidence: string | null; delivery_permitted: number; qa_approved_at: string | null }

export async function createLicense(db: D1Database, p: ProjectRow, input: z.infer<typeof licenseSchema>, actorId: string) {
  if (input.assetId) {
    const a = await db.prepare('SELECT id FROM assets WHERE id = ?1 AND project_id = ?2').bind(input.assetId, p.id).first()
    if (!a) throw new ApiError(404, 'NOT_FOUND', 'File tidak ditemukan pada proyek ini')
  }
  if (input.providerSlug) {
    const pr = await db.prepare('SELECT slug FROM providers WHERE slug = ?1').bind(input.providerSlug).first()
    if (!pr) throw new ApiError(422, 'UNKNOWN_PROVIDER', 'Provider belum terdaftar')
  }
  if (input.sourceType === 'ai_generated' && !input.providerSlug) throw new ApiError(422, 'PROVIDER_REQUIRED', 'Materi AI wajib mencantumkan provider')
  const id = newId()
  const now = nowIso()
  await db.batch([
    db.prepare(`INSERT INTO asset_licenses (id, project_id, asset_id, source_type, provider_slug, provider_reference, generation_notes, source_material, license_name, license_evidence, commercial_use, restrictions, delivery_permitted, created_by, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 0, ?13, ?14, ?14)`)
      .bind(id, p.id, input.assetId ?? null, input.sourceType, input.providerSlug ?? null, input.providerReference ?? null, input.generationNotes ?? null, input.sourceMaterial ?? null, input.licenseName ?? null, input.licenseEvidence ?? null, input.commercialUse, input.restrictions ?? null, actorId, now),
    eventStmt(db, { projectId: p.id, actorUserId: actorId, actorType: 'admin', eventType: 'license_recorded', metadata: { licenseId: id, assetId: input.assetId ?? null, sourceType: input.sourceType, commercialUse: input.commercialUse } }),
  ])
  return id
}

/** Human QA + rights clearance. Delivery may be permitted only with commercial use 'allowed' AND written evidence. */
export async function qaLicense(db: D1Database, p: ProjectRow, licenseId: string, input: z.infer<typeof licenseQaSchema>, actorId: string) {
  const l = /^[0-9a-f-]{36}$/i.test(licenseId) ? await db.prepare('SELECT * FROM asset_licenses WHERE id = ?1 AND project_id = ?2').bind(licenseId, p.id).first<LicenseRow>() : null
  if (!l) throw new ApiError(404, 'NOT_FOUND', 'Catatan lisensi tidak ditemukan')
  if (input.deliveryPermitted && (l.commercial_use !== 'allowed' || !l.license_evidence)) {
    throw new ApiError(409, 'LICENSE_NOT_CLEARED', 'Pengiriman hanya boleh diizinkan bila penggunaan komersial "allowed" dan bukti lisensi tercatat')
  }
  const now = nowIso()
  await db.batch([
    db.prepare('UPDATE asset_licenses SET delivery_permitted = ?1, qa_approved_by = ?2, qa_approved_at = ?3, updated_at = ?3 WHERE id = ?4').bind(input.deliveryPermitted ? 1 : 0, actorId, now, l.id),
    eventStmt(db, { projectId: p.id, actorUserId: actorId, actorType: 'admin', eventType: 'license_qa_recorded', metadata: { licenseId: l.id, deliveryPermitted: input.deliveryPermitted, note: input.note ?? null } }),
  ])
}

/**
 * Delivery gate: the approved final asset must have ≥1 QA-approved licence record permitting delivery,
 * and no record for that asset may say commercial use is not allowed.
 */
export async function assertDeliveryCleared(db: D1Database, projectId: string, assetId: string) {
  const rows = await db.prepare('SELECT commercial_use, delivery_permitted, qa_approved_at FROM asset_licenses WHERE project_id = ?1 AND asset_id = ?2').bind(projectId, assetId).all<{ commercial_use: string; delivery_permitted: number; qa_approved_at: string | null }>()
  const list = rows.results ?? []
  if (list.some((r) => r.commercial_use === 'not_allowed')) throw new ApiError(409, 'LICENSE_BLOCKED', 'File final memiliki materi yang tidak boleh dipakai komersial')
  if (!list.some((r) => r.delivery_permitted === 1 && r.qa_approved_at)) throw new ApiError(409, 'LICENSE_CLEARANCE_REQUIRED', 'Catat lisensi & QA (izin kirim) untuk file final sebelum dikirim')
}

// ---------- Providers ----------
export const providerUpdateSchema = z.object({
  termsUrl: z.string().trim().url().max(300).optional(),
  termsCheckedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  commercialUse: z.enum(COMMERCIAL_USE).optional(),
  apiAvailable: z.enum(['unverified', 'yes', 'no']).optional(),
  notes: z.string().trim().max(2000).optional(),
})

// ---------- Support tickets ----------
export const supportSchema = z.object({ category: z.enum(['question', 'issue', 'refund_request', 'other']), message: z.string().trim().min(5).max(4000) })
export const supportResolveSchema = z.object({ note: z.string().trim().min(2).max(1000) })
