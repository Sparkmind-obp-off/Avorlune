import { z } from 'zod'
import { ApiError, newId, nowIso } from '../lib/http'
import { eventStmt } from './events'
import type { ProjectRow } from './projects'

/**
 * Action-service runs (docs/77 §3, docs/78 Phase 5). Human-operated: no unattended execution, no provider automation.
 * Customer authorization is mandatory for any run with an external side effect and moves the run to `queued`
 * only through the customer endpoint — staff can never self-authorize.
 */
export const RUN_STATUSES = ['draft', 'awaiting_authorization', 'queued', 'manual_in_progress', 'review', 'completed', 'failed', 'cancelled'] as const
export type RunStatus = (typeof RUN_STATUSES)[number]

export const RUN_TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  draft: ['awaiting_authorization', 'queued', 'cancelled'],
  awaiting_authorization: ['cancelled'],
  queued: ['manual_in_progress', 'cancelled'],
  manual_in_progress: ['review', 'failed', 'cancelled'],
  review: ['completed', 'manual_in_progress', 'failed'],
  failed: ['queued', 'cancelled'],
  completed: [],
  cancelled: [],
}

/** Runs exist only after payment has moved the project into production (deposit gate). */
export const ACTION_ELIGIBLE_PROJECT_STATUSES = ['queued', 'producing', 'internal_review', 'customer_review', 'revision'] as const
export const MAX_RUN_ATTEMPTS = 3

export const createRunSchema = z.object({
  title: z.string().trim().min(3).max(140),
  objective: z.string().trim().min(10).max(2000),
  allowedOperations: z.string().trim().min(5).max(1000),
  inputsRef: z.string().trim().max(500).optional(),
  externalSideEffect: z.boolean().default(false),
  requiresCustomerAuthorization: z.boolean().default(true),
})

export const transitionRunSchema = z.object({
  to: z.enum(RUN_STATUSES),
  note: z.string().trim().max(2000).optional(),
  visibility: z.enum(['public', 'internal']).default('internal'),
  resultSummary: z.string().trim().max(2000).optional(),
  errorCode: z.string().trim().regex(/^[A-Z0-9_]{2,40}$/).optional(),
})

export const authorizeRunSchema = z.object({ confirm: z.literal(true) })

export interface RunRow {
  id: string; project_id: string; title: string; objective: string; allowed_operations: string; inputs_ref: string | null
  external_side_effect: number; requires_customer_authorization: number; status: RunStatus; authorized_at: string | null
  authorized_by_customer_id: string | null; authorization_scope: string | null; attempts: number; error_code: string | null
  result_summary: string | null; created_at: string; updated_at: string
}

const uuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v)

export async function getRun(db: D1Database, projectId: string, runId: string) {
  if (!uuid(runId)) return null
  return db.prepare('SELECT * FROM action_runs WHERE id = ?1 AND project_id = ?2').bind(runId, projectId).first<RunRow>()
}

function stepStmt(db: D1Database, runId: string, from: string | null, to: string, actorType: 'system' | 'customer' | 'admin', actorId: string | null, visibility: 'public' | 'internal', note: string | null, at: string) {
  return db.prepare(`INSERT INTO action_run_steps (id, run_id, from_status, to_status, actor_type, actor_id, visibility, note, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`)
    .bind(newId(), runId, from, to, actorType, actorId, visibility, note, at)
}

export async function createRun(db: D1Database, p: ProjectRow, input: z.infer<typeof createRunSchema>, actorId: string) {
  if (!(ACTION_ELIGIBLE_PROJECT_STATUSES as readonly string[]).includes(p.status)) {
    throw new ApiError(409, 'PROJECT_NOT_ELIGIBLE', 'Aksi layanan hanya untuk proyek yang pembayarannya sudah terverifikasi (antrean, produksi atau review)')
  }
  const requiresAuth = input.externalSideEffect ? true : input.requiresCustomerAuthorization
  const id = newId()
  const now = nowIso()
  await db.batch([
    db.prepare(`INSERT INTO action_runs (id, project_id, title, objective, allowed_operations, inputs_ref, external_side_effect, requires_customer_authorization, status, attempts, created_by, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'draft', 0, ?9, ?10, ?10)`)
      .bind(id, p.id, input.title, input.objective, input.allowedOperations, input.inputsRef ?? null, input.externalSideEffect ? 1 : 0, requiresAuth ? 1 : 0, actorId, now),
    stepStmt(db, id, null, 'draft', 'admin', actorId, 'internal', null, now),
    eventStmt(db, { projectId: p.id, actorUserId: actorId, actorType: 'admin', eventType: 'action_run_created', metadata: { runId: id, externalSideEffect: input.externalSideEffect, requiresAuthorization: requiresAuth } }),
  ])
  return id
}

export async function transitionRun(db: D1Database, p: ProjectRow, runId: string, input: z.infer<typeof transitionRunSchema>, actorId: string) {
  const r = await getRun(db, p.id, runId)
  if (!r) throw new ApiError(404, 'NOT_FOUND', 'Aksi tidak ditemukan')
  const from = r.status
  if (!RUN_TRANSITIONS[from].includes(input.to)) throw new ApiError(409, 'INVALID_RUN_TRANSITION', `Transisi ${from} → ${input.to} tidak diizinkan`)
  if (from === 'draft' && input.to === 'queued' && r.requires_customer_authorization) {
    throw new ApiError(409, 'AUTHORIZATION_REQUIRED', 'Aksi ini wajib disetujui klien sebelum dijalankan')
  }
  if (input.to === 'failed' && !input.errorCode) throw new ApiError(422, 'ERROR_CODE_REQUIRED', 'Kode error wajib diisi untuk status gagal')
  if (input.to === 'completed' && !input.resultSummary) throw new ApiError(422, 'RESULT_REQUIRED', 'Ringkasan hasil wajib diisi untuk menyelesaikan aksi')
  const retry = from === 'failed' && input.to === 'queued'
  const attempts = retry ? r.attempts + 1 : r.attempts
  if (retry && attempts > MAX_RUN_ATTEMPTS) throw new ApiError(409, 'RETRY_LIMIT', `Batas percobaan ulang (${MAX_RUN_ATTEMPTS}) tercapai`)
  const now = nowIso()
  const res = await db.batch([
    db.prepare(`UPDATE action_runs SET status = ?1, attempts = ?2, error_code = ?3, result_summary = COALESCE(?4, result_summary), updated_at = ?5 WHERE id = ?6 AND status = ?7`)
      .bind(input.to, attempts, input.to === 'failed' ? input.errorCode : null, input.resultSummary ?? null, now, r.id, from),
    stepStmt(db, r.id, from, input.to, 'admin', actorId, input.visibility, input.note ?? null, now),
    eventStmt(db, { projectId: p.id, actorUserId: actorId, actorType: 'admin', eventType: 'action_run_transition', fromStatus: from, toStatus: input.to, metadata: { runId: r.id, attempts } }),
  ])
  if ((res[0].meta.changes ?? 0) !== 1) throw new ApiError(409, 'STALE_STATE', 'Status aksi telah berubah. Muat ulang dan coba lagi.')
}

/** Customer authorization (signed project link or verified Clerk owner). Snapshot of the authorized scope is stored. */
export async function authorizeRun(db: D1Database, p: ProjectRow, runId: string, customerId: string | null) {
  const r = await getRun(db, p.id, runId)
  if (!r) throw new ApiError(404, 'NOT_FOUND', 'Aksi tidak ditemukan')
  if (r.status !== 'awaiting_authorization') throw new ApiError(409, 'NOT_AWAITING_AUTHORIZATION', 'Aksi ini tidak sedang menunggu persetujuan')
  const now = nowIso()
  const res = await db.batch([
    db.prepare(`UPDATE action_runs SET status = 'queued', authorized_at = ?1, authorized_by_customer_id = ?2, authorization_scope = allowed_operations, updated_at = ?1
                WHERE id = ?3 AND status = 'awaiting_authorization'`).bind(now, customerId, r.id),
    stepStmt(db, r.id, 'awaiting_authorization', 'queued', 'customer', customerId, 'public', 'Disetujui oleh klien', now),
    eventStmt(db, { projectId: p.id, actorType: 'customer', eventType: 'action_run_authorized', metadata: { runId: r.id, via: customerId ? 'account' : 'project_link' } }),
  ])
  if ((res[0].meta.changes ?? 0) !== 1) throw new ApiError(409, 'STALE_STATE', 'Status aksi telah berubah')
}

/** Customer-visible view: public steps only, no internal notes, no actor ids. */
export async function customerRuns(db: D1Database, projectId: string) {
  const runs = await db.prepare('SELECT * FROM action_runs WHERE project_id = ?1 AND status != ?2 ORDER BY created_at DESC LIMIT 50').bind(projectId, 'draft').all<RunRow>()
  const list = runs.results ?? []
  if (list.length === 0) return []
  const steps = await db.prepare(`SELECT s.run_id, s.to_status, s.note, s.created_at FROM action_run_steps s JOIN action_runs r ON r.id = s.run_id
                                  WHERE r.project_id = ?1 AND s.visibility = 'public' ORDER BY s.created_at ASC`).bind(projectId).all<{ run_id: string; to_status: string; note: string | null; created_at: string }>()
  return list.map((r) => ({
    id: r.id, title: r.title, objective: r.objective, allowedOperations: r.allowed_operations, status: r.status,
    requiresAuthorization: !!r.requires_customer_authorization, externalSideEffect: !!r.external_side_effect, authorizedAt: r.authorized_at,
    resultSummary: r.status === 'completed' ? r.result_summary : null,
    steps: (steps.results ?? []).filter((s) => s.run_id === r.id).map((s) => ({ toStatus: s.to_status, note: s.note, at: s.created_at })),
  }))
}

export async function adminRuns(db: D1Database, projectId: string) {
  const runs = await db.prepare('SELECT * FROM action_runs WHERE project_id = ?1 ORDER BY created_at DESC LIMIT 100').bind(projectId).all<RunRow>()
  const steps = await db.prepare(`SELECT s.* FROM action_run_steps s JOIN action_runs r ON r.id = s.run_id WHERE r.project_id = ?1 ORDER BY s.created_at ASC`).bind(projectId).all<{ run_id: string }>()
  return (runs.results ?? []).map((r) => ({ ...r, steps: (steps.results ?? []).filter((s) => s.run_id === r.id), nextStatuses: RUN_TRANSITIONS[r.status] }))
}
