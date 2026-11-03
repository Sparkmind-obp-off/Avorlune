import { ApiError, newId, nowIso } from '../lib/http'

/**
 * 50% deposit + 50% balance payment schedule (docs/56, docs/59).
 * - Amounts are computed server-side from the accepted quote, integer IDR: deposit = ceil(total/2), balance = total − deposit.
 * - Deposit gates the production queue; balance gates final delivery (and final-file download).
 * - Legacy confirmed payments recorded before milestones existed are applied in order (deposit first) without changing them.
 * Project status and payment status stay independent.
 */
export interface MilestoneRow {
  id: string; project_id: string; quote_id: string; kind: 'deposit' | 'balance' | 'full'; sequence: number
  amount_minor: number; status: 'unpaid' | 'paid' | 'cancelled'; payment_id: string | null; paid_at: string | null
}

export function splitAmount(total: number) {
  if (!Number.isInteger(total) || total <= 0) return []
  if (total < 2) return [{ kind: 'full' as const, sequence: 1, amount: total }]
  const deposit = Math.ceil(total / 2)
  return [
    { kind: 'deposit' as const, sequence: 1, amount: deposit },
    { kind: 'balance' as const, sequence: 2, amount: total - deposit },
  ]
}

/** Statements that create milestones for an accepted quote (idempotent through UNIQUE(quote_id, kind)). */
export function milestoneStmts(db: D1Database, projectId: string, quoteId: string, total: number, at = nowIso()) {
  return splitAmount(total).map((m) =>
    db.prepare(`INSERT OR IGNORE INTO payment_milestones (id, project_id, quote_id, kind, sequence, amount_minor, status, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'unpaid', ?7, ?7)`).bind(newId(), projectId, quoteId, m.kind, m.sequence, m.amount, at),
  )
}

async function acceptedQuote(db: D1Database, projectId: string) {
  return db.prepare(`SELECT id, amount_minor FROM quotes WHERE project_id = ?1 AND status = 'accepted' ORDER BY accepted_at DESC LIMIT 1`).bind(projectId).first<{ id: string; amount_minor: number }>()
}

/**
 * Returns the milestones of the project's accepted quote, creating them if missing (legacy quotes accepted before 0005)
 * and applying legacy confirmed payments that are not yet linked to a milestone.
 */
export async function ensureSchedule(db: D1Database, projectId: string): Promise<{ quoteId: string; total: number; milestones: MilestoneRow[] } | null> {
  const q = await acceptedQuote(db, projectId)
  if (!q) return null
  let rows = await db.prepare('SELECT * FROM payment_milestones WHERE quote_id = ?1 ORDER BY sequence').bind(q.id).all<MilestoneRow>()
  if ((rows.results ?? []).length === 0 && q.amount_minor > 0) {
    await db.batch(milestoneStmts(db, projectId, q.id, q.amount_minor))
    rows = await db.prepare('SELECT * FROM payment_milestones WHERE quote_id = ?1 ORDER BY sequence').bind(q.id).all<MilestoneRow>()
  }
  let milestones = rows.results ?? []
  // Legacy payments (no milestone link): apply cumulatively in sequence, never altering the payment record itself.
  const legacy = await db.prepare(`SELECT id, amount_minor, confirmed_at FROM payments WHERE project_id = ?1 AND milestone_id IS NULL AND status IN ('paid','manually_confirmed') ORDER BY created_at`)
    .bind(projectId).all<{ id: string; amount_minor: number; confirmed_at: string }>()
  const legacyRows = legacy.results ?? []
  if (legacyRows.length > 0 && milestones.some((m) => m.status === 'unpaid')) {
    let credit = legacyRows.reduce((a, b) => a + b.amount_minor, 0) - milestones.filter((m) => m.status === 'paid').reduce((a, b) => a + b.amount_minor, 0)
    const stmts: D1PreparedStatement[] = []
    for (const m of milestones) {
      if (m.status !== 'unpaid') continue
      if (credit < m.amount_minor) break
      credit -= m.amount_minor
      stmts.push(db.prepare(`UPDATE payment_milestones SET status = 'paid', paid_at = ?1, payment_id = ?2, updated_at = ?1 WHERE id = ?3 AND status = 'unpaid'`)
        .bind(legacyRows[legacyRows.length - 1].confirmed_at, legacyRows[legacyRows.length - 1].id, m.id))
    }
    if (stmts.length) {
      await db.batch(stmts)
      milestones = (await db.prepare('SELECT * FROM payment_milestones WHERE quote_id = ?1 ORDER BY sequence').bind(q.id).all<MilestoneRow>()).results ?? []
    }
  }
  return { quoteId: q.id, total: q.amount_minor, milestones }
}

export const isPaid = (m?: MilestoneRow) => !!m && m.status === 'paid'

/** Deposit (or full) verified → production may start. Free (0) quotes need no payment. */
export async function depositSatisfied(db: D1Database, projectId: string) {
  const s = await ensureSchedule(db, projectId)
  if (!s) return false
  if (s.total === 0) return true
  const first = s.milestones.find((m) => m.sequence === 1)
  return isPaid(first)
}

/** Every milestone paid → final release allowed. */
export async function balanceSatisfied(db: D1Database, projectId: string) {
  const s = await ensureSchedule(db, projectId)
  if (!s) return false
  if (s.total === 0) return true
  return s.milestones.length > 0 && s.milestones.every((m) => m.status === 'paid')
}

/** Project statuses in which each milestone may be paid online. Balance is issued once a preview is ready. */
export const DEPOSIT_STATUSES = ['quoted', 'awaiting_payment'] as const
export const BALANCE_STATUSES = ['customer_review', 'revision', 'approved'] as const

/** The next milestone the customer may pay now, or null. Client never chooses milestone or amount. */
export async function nextPayableMilestone(db: D1Database, projectId: string, projectStatus: string) {
  const s = await ensureSchedule(db, projectId)
  if (!s) return null
  const next = s.milestones.find((m) => m.status === 'unpaid')
  if (!next) return null
  const allowed = next.kind === 'balance' ? BALANCE_STATUSES : DEPOSIT_STATUSES
  return (allowed as readonly string[]).includes(projectStatus) ? next : null
}

/**
 * Manual (admin, step-up) payment: must match exactly one unpaid milestone — the next one in sequence.
 * No silent partial or combined settlement.
 */
export async function milestoneForManualPayment(db: D1Database, projectId: string, amountMinor: number) {
  const s = await ensureSchedule(db, projectId)
  if (!s) return null
  const next = s.milestones.find((m) => m.status === 'unpaid')
  if (!next) throw new ApiError(409, 'ALREADY_PAID', 'Semua termin pembayaran untuk penawaran ini sudah lunas')
  if (next.amount_minor !== amountMinor) {
    throw new ApiError(422, 'AMOUNT_MISMATCH', `Jumlah harus sama dengan termin berikutnya (${next.kind === 'deposit' ? 'DP 50%' : next.kind === 'balance' ? 'pelunasan 50%' : 'pembayaran'}: ${next.amount_minor})`)
  }
  return next
}

/** Public schedule view (customer + admin). */
export async function scheduleView(db: D1Database, projectId: string) {
  const s = await ensureSchedule(db, projectId)
  if (!s) return null
  const paid = s.milestones.filter((m) => m.status === 'paid').reduce((a, b) => a + b.amount_minor, 0)
  return {
    totalMinor: s.total,
    paidMinor: paid,
    remainingMinor: Math.max(0, s.total - paid),
    status: s.total === 0 ? 'paid' : paid === 0 ? 'unpaid' : paid >= s.total ? 'paid' : 'partially_paid',
    milestones: s.milestones.map((m) => ({ id: m.id, kind: m.kind, sequence: m.sequence, amountMinor: m.amount_minor, status: m.status, paidAt: m.paid_at })),
  }
}
