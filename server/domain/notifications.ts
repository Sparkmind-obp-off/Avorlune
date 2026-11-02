import type { Env } from '../env'
import { newId, nowIso } from '../lib/http'
import { logEvent } from '../lib/log'
import { formatIDR } from '../../shared/domain'
import type { ProjectRow } from './projects'

/**
 * Transactional notification outbox (docs/54 §3).
 * - Every lifecycle event enqueues exactly one row per project+event+key (dedupe_key UNIQUE).
 * - Recipient is resolved from the project at send time; the outbox stores no contact copy.
 * - Automatic email sending happens ONLY when NOTIFY_EMAIL_ENABLED='true' AND RESEND_API_KEY AND NOTIFY_FROM_EMAIL
 *   are configured (owner approval + verified sender domain). Otherwise rows stay 'pending' for manual sending
 *   (WhatsApp/email) by an admin, who marks them 'manual_sent'. No provider is claimed as active.
 */
export const NOTIFICATION_EVENTS = [
  'project_submitted', 'quote_sent', 'quote_accepted', 'payment_pending', 'payment_success', 'payment_failed',
  'production_started', 'revision_requested', 'ready_for_review', 'final_delivered', 'refund_processed', 'refund_rejected',
] as const
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number]

const MAX_ATTEMPTS = 5
const BACKOFF_MIN = [1, 5, 30, 120, 720]

interface Ctx { reference: string; title: string; name: string; amountMinor?: number; portalHint: string }

const T: Record<NotificationEvent, (c: Ctx) => { subject: string; body: string }> = {
  project_submitted: (c) => ({ subject: `Brief ${c.reference} diterima`, body: `Halo ${c.name}, brief "${c.title}" (${c.reference}) sudah kami terima. Tim kami akan meninjau dan menghubungi Anda.` }),
  quote_sent: (c) => ({ subject: `Penawaran untuk ${c.reference}`, body: `Halo ${c.name}, penawaran untuk "${c.title}" sudah tersedia${c.amountMinor ? ` (${formatIDR(c.amountMinor)})` : ''}. ${c.portalHint}` }),
  quote_accepted: (c) => ({ subject: `Penawaran ${c.reference} disetujui`, body: `Terima kasih, ${c.name}. Penawaran untuk "${c.title}" telah Anda setujui. Langkah berikutnya adalah pembayaran.` }),
  payment_pending: (c) => ({ subject: `Menunggu pembayaran ${c.reference}`, body: `Tagihan untuk "${c.title}"${c.amountMinor ? ` sebesar ${formatIDR(c.amountMinor)}` : ''} menunggu pembayaran. ${c.portalHint}` }),
  payment_success: (c) => ({ subject: `Pembayaran ${c.reference} diterima`, body: `Pembayaran untuk "${c.title}"${c.amountMinor ? ` sebesar ${formatIDR(c.amountMinor)}` : ''} telah terverifikasi. Proyek masuk antrean produksi.` }),
  payment_failed: (c) => ({ subject: `Pembayaran ${c.reference} belum berhasil`, body: `Pembayaran untuk "${c.title}" tidak berhasil atau kedaluwarsa. Anda dapat mencoba lagi melalui portal proyek atau menghubungi kami.` }),
  production_started: (c) => ({ subject: `Produksi ${c.reference} dimulai`, body: `Tim kami mulai mengerjakan "${c.title}".` }),
  revision_requested: (c) => ({ subject: `Revisi ${c.reference} diterima`, body: `Catatan revisi untuk "${c.title}" sudah kami terima dan akan diproses.` }),
  ready_for_review: (c) => ({ subject: `${c.reference} siap direview`, body: `Hasil untuk "${c.title}" siap Anda review. ${c.portalHint}` }),
  final_delivered: (c) => ({ subject: `${c.reference} telah dikirim`, body: `File final untuk "${c.title}" telah dikirim. Terima kasih telah bekerja sama dengan AVORLUNE.` }),
  refund_processed: (c) => ({ subject: `Refund ${c.reference} diproses`, body: `Refund${c.amountMinor ? ` sebesar ${formatIDR(c.amountMinor)}` : ''} untuk "${c.title}" telah diproses. Waktu dana masuk mengikuti bank/kanal pembayaran.` }),
  refund_rejected: (c) => ({ subject: `Permintaan refund ${c.reference}`, body: `Permintaan refund untuk "${c.title}" tidak dapat disetujui. Tim kami akan menjelaskan alasannya melalui kanal kontak Anda.` }),
}

/** Lifecycle status → notification event (only customer-relevant transitions). */
export const STATUS_NOTIFICATIONS: Partial<Record<string, NotificationEvent>> = {
  producing: 'production_started',
  customer_review: 'ready_for_review',
  revision: 'revision_requested',
  delivered: 'final_delivered',
}

export function renderNotification(event: NotificationEvent, p: Pick<ProjectRow, 'public_reference' | 'title' | 'customer_name'>, amountMinor?: number) {
  return T[event]({ reference: p.public_reference, title: p.title, name: p.customer_name.split(' ')[0] || 'Klien', amountMinor, portalHint: 'Buka tautan portal proyek yang kami kirimkan untuk detailnya.' })
}

/** Statement that enqueues a notification; safe to include in a batch. Duplicate keys are ignored. */
export function notificationStmt(db: D1Database, p: Pick<ProjectRow, 'id' | 'public_reference' | 'title' | 'customer_name' | 'contact_method'>, event: NotificationEvent, key: string, amountMinor?: number) {
  const { subject, body } = renderNotification(event, p, amountMinor)
  const now = nowIso()
  const channel = p.contact_method === 'email' ? 'email' : 'whatsapp'
  return db
    .prepare(`INSERT OR IGNORE INTO notifications (id, project_id, event, channel, subject, body, status, attempts, next_attempt_at, dedupe_key, created_at, updated_at)
              VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', 0, ?7, ?8, ?7, ?7)`)
    .bind(newId(), p.id, event, channel, subject.slice(0, 200), body.slice(0, 2000), now, `${p.id}:${event}:${key}`.slice(0, 200))
}

export async function enqueueNotification(db: D1Database, p: Parameters<typeof notificationStmt>[1], event: NotificationEvent, key: string, amountMinor?: number) {
  try {
    await notificationStmt(db, p, event, key, amountMinor).run()
  } catch (e) {
    // Notifications must never break the business transaction that triggered them.
    logEvent('warn', 'notification_enqueue_failed', { event, message: String((e as Error)?.message ?? e) })
  }
}

export function emailSendingEnabled(env: Env) {
  return env.NOTIFY_EMAIL_ENABLED === 'true' && !!env.RESEND_API_KEY && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(env.NOTIFY_FROM_EMAIL ?? '')
}

interface Row { id: string; project_id: string; channel: string; subject: string; body: string; attempts: number }

/**
 * Deliver due email notifications through Resend. Bounded batch, exponential backoff, failure tracking.
 * Called opportunistically (admin request) — no cron is required (hosted cron triggers are not used).
 */
export async function processOutbox(env: Env, db: D1Database, limit = 5) {
  if (!emailSendingEnabled(env)) return { enabled: false as const, sent: 0, failed: 0 }
  const now = nowIso()
  const due = await db
    .prepare(`SELECT n.id, n.project_id, n.channel, n.subject, n.body, n.attempts FROM notifications n
              WHERE n.status = 'pending' AND n.channel = 'email' AND (n.next_attempt_at IS NULL OR n.next_attempt_at <= ?1) ORDER BY n.created_at LIMIT ?2`)
    .bind(now, limit)
    .all<Row>()
  let sent = 0
  let failed = 0
  for (const n of due.results ?? []) {
    const p = await db.prepare(`SELECT customer_contact, contact_method FROM projects WHERE id = ?1`).bind(n.project_id).first<{ customer_contact: string; contact_method: string }>()
    if (!p || p.contact_method !== 'email') {
      await db.prepare(`UPDATE notifications SET status = 'cancelled', last_error = 'NO_EMAIL_RECIPIENT', updated_at = ?1 WHERE id = ?2`).bind(now, n.id).run()
      continue
    }
    const attempts = n.attempts + 1
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json', 'idempotency-key': n.id },
        body: JSON.stringify({ from: env.NOTIFY_FROM_EMAIL, to: [p.customer_contact], subject: n.subject, text: n.body }),
      })
      const j = (await res.json().catch(() => null)) as { id?: string } | null
      if (res.ok && j?.id) {
        await db.prepare(`UPDATE notifications SET status = 'sent', provider = 'resend', provider_message_id = ?1, attempts = ?2, sent_at = ?3, last_error = NULL, updated_at = ?3 WHERE id = ?4 AND status = 'pending'`).bind(String(j.id).slice(0, 100), attempts, nowIso(), n.id).run()
        sent++
        continue
      }
      throw new Error(`HTTP_${res.status}`)
    } catch (e) {
      failed++
      const code = String((e as Error)?.message ?? 'ERROR').slice(0, 60)
      const terminal = attempts >= MAX_ATTEMPTS
      const next = new Date(Date.now() + BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)] * 60_000).toISOString()
      await db.prepare(`UPDATE notifications SET status = ?1, attempts = ?2, last_error = ?3, next_attempt_at = ?4, provider = 'resend', updated_at = ?5 WHERE id = ?6 AND status = 'pending'`)
        .bind(terminal ? 'failed' : 'pending', attempts, code, terminal ? null : next, nowIso(), n.id).run()
      logEvent('warn', 'notification_send_failed', { notificationId: n.id, attempts, code })
    }
  }
  return { enabled: true as const, sent, failed }
}
