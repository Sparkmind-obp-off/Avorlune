import { useEffect, useRef, useState } from 'react'
import { Alert } from './Field'
import { api, ApiFailure, formatDate } from '../lib/api'
import { formatIDR } from '../../shared/domain'

export interface PaymentOrderInfo {
  id: string; merchantOrderId: string; amountMinor: number; status: string; paymentCode: string | null
  expiresAt: string | null; paidAt: string | null; createdAt: string; environment: string
}
export interface ScheduleInfo {
  totalMinor: number; paidMinor: number; remainingMinor: number; status: string
  milestones: { id: string; kind: 'deposit' | 'balance' | 'full'; sequence: number; amountMinor: number; status: string; paidAt: string | null }[]
}
export interface PaymentInfo {
  onlineEnabled: boolean; canPay: boolean; needsEmail: boolean; orders: PaymentOrderInfo[]
  schedule?: ScheduleInfo | null; nextMilestone?: { kind: string; amountMinor: number } | null
}
export const MILESTONE_LABEL: Record<string, string> = { deposit: 'DP 50%', balance: 'Pelunasan 50%', full: 'Pembayaran' }
const MILESTONE_HINT: Record<string, string> = {
  deposit: 'Dibayar setelah penawaran disetujui. Produksi dimulai setelah DP terverifikasi.',
  balance: 'Dibayar setelah preview dan revisi yang termasuk selesai. File final tanpa watermark dirilis setelah pelunasan terverifikasi.',
  full: 'Pembayaran penuh sesuai penawaran.',
}

interface CheckoutResult { order: PaymentOrderInfo; reference: string; popScript: string; paymentUrl: string | null; reused: boolean }

/** Only official Duitku POP hosts may ever be loaded (defence against a tampered API response). */
const POP_HOSTS = new Set(['app-prod.duitku.com', 'app-sandbox.duitku.com'])
const PAY_HOSTS = /^https:\/\/([a-z0-9-]+\.)*duitku\.com\//i

const STATUS_LABEL: Record<string, string> = {
  created: 'Dibuat', pending: 'Menunggu pembayaran', paid: 'Lunas (terverifikasi server)', failed: 'Gagal',
  expired: 'Kedaluwarsa', cancelled: 'Dibatalkan',
}

type DuitkuCheckout = { process: (ref: string, opts: Record<string, unknown>) => void }

function loadPop(src: string): Promise<DuitkuCheckout> {
  const url = new URL(src)
  if (url.protocol !== 'https:' || !POP_HOSTS.has(url.hostname)) return Promise.reject(new Error('host'))
  const w = window as unknown as { checkout?: DuitkuCheckout }
  if (w.checkout) return Promise.resolve(w.checkout)
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = url.toString(); s.async = true
    s.onload = () => (w.checkout ? resolve(w.checkout) : reject(new Error('missing')))
    s.onerror = () => reject(new Error('load'))
    document.head.appendChild(s)
  })
}

export function PaymentPanel({ reference, token, payment, onChanged }: { reference: string; token: string; payment: PaymentInfo; onChanged: () => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null)
  const returned = useRef(false)
  const base = `/projects/${encodeURIComponent(reference)}/payments`

  async function refresh(orderId: string, silent = false) {
    try {
      const r = await api<{ order: PaymentOrderInfo }>(`${base}/${orderId}/refresh`, { method: 'POST', json: {}, projectToken: token })
      if (!silent) setMsg(r.order.status === 'paid'
        ? { kind: 'success', text: 'Pembayaran terverifikasi oleh server. Proyek masuk antrean produksi.' }
        : { kind: 'info', text: `Status pembayaran: ${STATUS_LABEL[r.order.status] ?? r.order.status}.` })
      await onChanged()
    } catch (e) {
      if (!silent) setMsg({ kind: 'error', text: e instanceof ApiFailure ? e.body.message : 'Gagal memeriksa status' })
    }
  }

  // Returning from the Duitku redirect page: the URL parameter is only a hint — verify server-side.
  useEffect(() => {
    if (returned.current) return
    returned.current = true
    const params = new URLSearchParams(window.location.search)
    const pending = payment.orders.find((o) => o.status === 'pending')
    if (params.get('payment') === 'return' && pending) void refresh(pending.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function pay() {
    setBusy(true); setMsg(null)
    try {
      const r = await api<CheckoutResult>(`${base}/checkout`, { method: 'POST', json: payment.needsEmail ? { email } : {}, projectToken: token })
      await onChanged()
      try {
        const checkout = await loadPop(r.popScript)
        const done = () => void refresh(r.order.id)
        checkout.process(r.reference, { successEvent: done, pendingEvent: done, errorEvent: done, closeEvent: () => void refresh(r.order.id, true) })
      } catch {
        if (r.paymentUrl && PAY_HOSTS.test(r.paymentUrl)) window.location.assign(r.paymentUrl)
        else setMsg({ kind: 'error', text: 'Jendela pembayaran tidak dapat dibuka. Silakan coba lagi.' })
      }
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof ApiFailure ? e.body.message : 'Gagal memulai pembayaran' })
    } finally { setBusy(false) }
  }

  if (!payment.schedule && !payment.onlineEnabled && payment.orders.length === 0) return null
  const emailOk = !payment.needsEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  return (
    <article className="panel" id="payment-panel">
      <h2 className="h4">Pembayaran</h2>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      {payment.schedule && (
        <div id="payment-schedule">
          <dl className="kv small">
            <dt>Total penawaran</dt><dd>{formatIDR(payment.schedule.totalMinor)}</dd>
            <dt>Sudah dibayar</dt><dd>{formatIDR(payment.schedule.paidMinor)}</dd>
            <dt>Sisa</dt><dd>{formatIDR(payment.schedule.remainingMinor)}</dd>
          </dl>
          <ol className="milestones">
            {payment.schedule.milestones.map((m) => (
              <li key={m.id} className={m.status === 'paid' ? 'is-paid' : ''}>
                <strong>{MILESTONE_LABEL[m.kind] ?? m.kind}</strong> · {formatIDR(m.amountMinor)} ·{' '}
                <span className={`tag t-${m.status === 'paid' ? 'accepted' : m.status}`}>{m.status === 'paid' ? `Lunas ${formatDate(m.paidAt)}` : 'Belum dibayar'}</span>
                <div className="small muted">{MILESTONE_HINT[m.kind]}</div>
              </li>
            ))}
          </ol>
        </div>
      )}
      {payment.canPay && payment.nextMilestone && <p className="small"><strong>Tagihan saat ini: {MILESTONE_LABEL[payment.nextMilestone.kind]} — {formatIDR(payment.nextMilestone.amountMinor)}</strong></p>}
      {payment.canPay && (
        <>
          <p className="muted">Pembayaran diproses oleh Duitku. Status lunas hanya ditetapkan setelah verifikasi server ke Duitku.</p>
          {payment.needsEmail && (
            <>
              <label htmlFor="pay-email" className="block-label">Email untuk tanda terima</label>
              <input id="pay-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" />
            </>
          )}
          <div className="btn-row">
            <button className="btn btn-primary" disabled={busy || !emailOk} onClick={() => void pay()}>{busy ? 'Memproses…' : 'Bayar sekarang'}</button>
          </div>
        </>
      )}
      {!payment.onlineEnabled && payment.schedule && payment.schedule.remainingMinor > 0 && <p className="small muted">Pembayaran online sedang tidak aktif. Tim kami akan mengirim instruksi transfer untuk termin yang jatuh tempo; status diperbarui setelah dana diverifikasi.</p>}
      {payment.orders.length > 0 && (
        <ul className="asset-list" aria-label="Riwayat pembayaran">
          {payment.orders.map((o) => (
            <li key={o.id}>
              <div>
                <strong>{o.merchantOrderId}</strong> <span className={`tag t-${o.status === 'paid' ? 'accepted' : o.status}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
                <div className="small muted">{formatIDR(o.amountMinor)} · {formatDate(o.createdAt, true)}{o.status === 'pending' && o.expiresAt ? ` · berlaku s.d. ${formatDate(o.expiresAt, true)}` : ''}{o.paidAt ? ` · dibayar ${formatDate(o.paidAt, true)}` : ''}</div>
              </div>
              {o.status === 'pending' && payment.onlineEnabled && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void refresh(o.id)}>Cek status</button>}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
