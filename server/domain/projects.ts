import type { ProjectStatus } from '../../shared/domain'
import { canTransition } from '../../shared/domain'
import { ApiError, newId, nowIso } from '../lib/http'
import type { ActorType } from './events'
import type { Env } from '../env'
import { assertValidFinalAsset, getProjectAsset } from './assets'
import { balanceSatisfied, depositSatisfied } from './schedule'

export interface ProjectRow {
  id: string
  public_reference: string
  customer_name: string
  contact_method: string
  customer_contact: string
  service_type: string
  title: string
  objective: string
  brief_json: string
  intended_use: string
  requested_deadline: string | null
  status: ProjectStatus
  access_token_version: number
  revision_rounds_used: number
  approved_asset_id: string | null
  customer_id?: string | null
  offer_version_id?: string | null
  created_at: string
  updated_at: string
}

export async function getProjectById(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM projects WHERE id = ?1').bind(id).first<ProjectRow>()
}

export async function getProjectByReference(db: D1Database, ref: string) {
  return db.prepare('SELECT * FROM projects WHERE public_reference = ?1').bind(ref).first<ProjectRow>()
}

export async function requireProject(db: D1Database, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'NOT_FOUND', 'Proyek tidak ditemukan')
  const p = await getProjectById(db, id)
  if (!p) throw new ApiError(404, 'NOT_FOUND', 'Proyek tidak ditemukan')
  return p
}

export async function latestQuote(db: D1Database, projectId: string) {
  return db
    .prepare(`SELECT * FROM quotes WHERE project_id = ?1 AND status != 'draft' ORDER BY created_at DESC LIMIT 1`)
    .bind(projectId)
    .first<{ id: string; status: string; amount_minor: number; currency: string; scope_json: string; included_revision_rounds: number; estimated_delivery_at: string | null; accepted_at: string | null; created_at: string }>()
}

export async function hasConfirmedPayment(db: D1Database, projectId: string) {
  const r = await db
    .prepare(`SELECT COUNT(*) AS n FROM payments WHERE project_id = ?1 AND status IN ('manually_confirmed','paid')`)
    .bind(projectId)
    .first<{ n: number }>()
  return (r?.n ?? 0) > 0
}

/**
 * Business guards on top of the raw transition table (docs/07 + docs/08):
 * - "quoted" needs a sent quote.
 * - entering "queued" needs a confirmed payment OR a documented exception reason.
 * - "approved" set by staff needs a reason (e.g. approval received through another channel).
 * - "cancelled" needs a reason.
 */
export async function assertTransitionAllowed(db: D1Database, p: ProjectRow, to: ProjectStatus, reason?: string, env?: Env, assetId?: string) {
  if (!canTransition(p.status, to)) {
    throw new ApiError(409, 'INVALID_TRANSITION', `Transisi ${p.status} → ${to} tidak diizinkan`)
  }
  if (to === 'quoted') {
    const q = await latestQuote(db, p.id)
    if (!q || !['sent', 'accepted'].includes(q.status)) throw new ApiError(409, 'QUOTE_REQUIRED', 'Kirim penawaran terlebih dahulu')
  }
  // Deposit (50%) must be verified before production, unless a documented exception reason is given (audited).
  if (to === 'queued' && !(await depositSatisfied(db, p.id)) && !reason) {
    throw new ApiError(409, 'PAYMENT_REQUIRED', 'Butuh pembayaran DP 50% terverifikasi atau alasan pengecualian')
  }
  if ((to === 'cancelled' || to === 'approved') && !reason) {
    throw new ApiError(422, 'REASON_REQUIRED', 'Alasan wajib diisi untuk transisi ini')
  }
  // A2 — staff-recorded approval obeys the same final-deliverable invariant as customer approval.
  if (to === 'approved') await assertValidFinalAsset(env ?? {}, db, p.id, assetId)
  // A2 — "delivered" requires the approved final asset to still be valid and present.
  if (to === 'delivered') {
    const a = p.approved_asset_id ? await getProjectAsset(db, p.id, p.approved_asset_id) : null
    if (!a) throw new ApiError(409, 'FINAL_ASSET_INVALID', 'Tidak ada file final yang disetujui')
    await assertValidFinalAsset(env ?? {}, db, p.id, a.id)
  }
}

/**
 * Atomic compare-and-set status update + audit event in one D1 batch (batches run as a transaction).
 * The event insert is guarded on (status, updated_at) so a stale/concurrent request writes nothing.
 * Extra statements passed in must use the same guard via `guardedSql`.
 */
export async function transition(
  db: D1Database,
  p: ProjectRow,
  to: ProjectStatus,
  actor: { type: ActorType; userId?: string | null },
  metadata: Record<string, unknown> = {},
  extra: (stamp: string) => D1PreparedStatement[] = () => [],
) {
  const stamp = nowIso()
  const results = await db.batch([
    db.prepare('UPDATE projects SET status = ?1, updated_at = ?2 WHERE id = ?3 AND status = ?4').bind(to, stamp, p.id, p.status),
    db
      .prepare(
        `INSERT INTO project_events (id, project_id, actor_user_id, actor_type, event_type, from_status, to_status, safe_metadata_json, created_at)
         SELECT ?1, ?2, ?3, ?4, 'status_changed', ?5, ?6, ?7, ?8
         WHERE EXISTS (SELECT 1 FROM projects WHERE id = ?2 AND status = ?6 AND updated_at = ?8)`,
      )
      .bind(newId(), p.id, actor.userId ?? null, actor.type, p.status, to, JSON.stringify(metadata), stamp),
    ...extra(stamp),
  ])
  if ((results[0].meta.changes ?? 0) !== 1) {
    throw new ApiError(409, 'STALE_STATE', 'Status proyek telah berubah. Muat ulang dan coba lagi.')
  }
  return stamp
}

/** SQL suffix guard for extra statements inside a transition batch. Bind projectId, toStatus, stamp as the LAST 3 params. */
export const GUARD_SUFFIX = (n: number) =>
  ` WHERE EXISTS (SELECT 1 FROM projects WHERE id = ?${n} AND status = ?${n + 1} AND updated_at = ?${n + 2})`

/** Final delivery requires every payment milestone (incl. the 50% balance) to be verified (docs/59 §6). */
export async function assertBalancePaid(db: D1Database, projectId: string) {
  if (!(await balanceSatisfied(db, projectId))) throw new ApiError(409, 'BALANCE_REQUIRED', 'Pelunasan 50% belum terverifikasi; file final belum boleh dikirim')
}
