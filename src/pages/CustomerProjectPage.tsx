import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Alert } from '../components/Field'
import { api, ApiFailure, formatDate } from '../lib/api'
import { SERVICE_LABELS, formatIDR, type ProjectStatus, type ServiceType } from '../../shared/domain'

interface CustomerProject {
  reference: string; title: string; serviceType: ServiceType; status: ProjectStatus; statusLabel: string; createdAt: string
  revisionRoundsUsed: number
  quote: null | { id: string; status: string; amountMinor: number; deliverables: string[]; notes: string | null; includedRevisionRounds: number; estimatedDeliveryAt: string | null }
  timeline: { status: string; label: string; at: string }[]
  feedback: { id: string; message: string; revision_round: number; within_scope: number; created_at: string }[]
  actions: { canDecideQuote: boolean; canSubmitFeedback: boolean; canApprove: boolean }
}

const TOKEN_KEY = (ref: string) => `avl_pt_${ref}`

function useProjectToken(reference: string) {
  const [token] = useState(() => {
    const m = window.location.hash.match(/t=([A-Za-z0-9_\-.]+)/)
    if (m) {
      sessionStorage.setItem(TOKEN_KEY(reference), m[1])
      // Remove token from the address bar/history so it is not shared accidentally.
      history.replaceState(null, '', window.location.pathname)
      return m[1]
    }
    return sessionStorage.getItem(TOKEN_KEY(reference)) ?? ''
  })
  return token
}

export function CustomerProjectPage() {
  const { reference = '' } = useParams()
  const token = useProjectToken(reference)
  const [data, setData] = useState<CustomerProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!token) { setLoading(false); setError('Tautan akses tidak ditemukan. Gunakan tautan privat yang dikirim oleh tim AVORLUNE.'); return }
    setLoading(true)
    try {
      setData(await api<CustomerProject>(`/projects/${encodeURIComponent(reference)}`, { projectToken: token }))
      setError(null)
    } catch (e) {
      setError(e instanceof ApiFailure ? e.body.message : 'Gagal memuat proyek')
    } finally {
      setLoading(false)
    }
  }, [reference, token])

  useEffect(() => { void load() }, [load])

  async function act(path: string, json: unknown, msg: string) {
    setBusy(true); setNotice(null)
    try {
      await api(`/projects/${encodeURIComponent(reference)}${path}`, { method: 'POST', json, projectToken: token })
      setNotice(msg); setFeedback('')
      await load()
    } catch (e) {
      setError(e instanceof ApiFailure ? e.body.message : 'Aksi gagal')
    } finally { setBusy(false) }
  }

  if (loading) return <section className="section"><div className="container narrow"><p className="muted" role="status">Memuat proyek…</p></div></section>
  if (error && !data) return <section className="section"><div className="container narrow"><h1 className="h2">Proyek</h1><Alert kind="error">{error}</Alert></div></section>
  if (!data) return null

  const q = data.quote
  return (
    <section className="section">
      <div className="container narrow">
        <p className="eyebrow">Proyek {data.reference}</p>
        <h1 className="display h2">{data.title}</h1>
        <p className="muted">{SERVICE_LABELS[data.serviceType]} · Dibuat {formatDate(data.createdAt)}</p>
        <p><span className={`status-pill s-${data.status}`}>{data.statusLabel}</span></p>
        {notice && <Alert kind="success">{notice}</Alert>}
        {error && <Alert kind="error">{error}</Alert>}

        {q && (
          <article className="panel" id="quote-panel">
            <h2 className="h4">Penawaran</h2>
            <dl className="kv">
              <dt>Total</dt><dd>{formatIDR(q.amountMinor)}</dd>
              <dt>Revisi termasuk</dt><dd>{q.includedRevisionRounds} putaran</dd>
              <dt>Estimasi selesai</dt><dd>{formatDate(q.estimatedDeliveryAt)}</dd>
              <dt>Status</dt><dd>{q.status === 'sent' ? 'Menunggu keputusan Anda' : q.status === 'accepted' ? 'Disetujui' : q.status === 'rejected' ? 'Ditolak' : q.status}</dd>
            </dl>
            <h3 className="h5">Deliverable</h3>
            <ul className="tick-list">{q.deliverables.map((d) => <li key={d}>{d}</li>)}</ul>
            {q.notes && <p className="muted">{q.notes}</p>}
            {data.actions.canDecideQuote && (
              <div className="btn-row">
                <button className="btn btn-primary" disabled={busy} onClick={() => act('/quote/decision', { decision: 'accepted' }, 'Penawaran disetujui. Tim kami akan mengonfirmasi langkah pembayaran.')}>Setujui penawaran</button>
                <button className="btn btn-ghost" disabled={busy} onClick={() => confirm('Tolak penawaran ini?') && act('/quote/decision', { decision: 'rejected' }, 'Penawaran ditolak. Tim kami akan menghubungi Anda.')}>Tolak</button>
              </div>
            )}
          </article>
        )}

        {(data.actions.canSubmitFeedback || data.actions.canApprove) && (
          <article className="panel" id="review-panel">
            <h2 className="h4">Review</h2>
            <p className="muted">
              Preview dikirim oleh tim melalui kanal privat. Putaran revisi terpakai: {data.revisionRoundsUsed}
              {q ? ` dari ${q.includedRevisionRounds} yang termasuk` : ''}. Revisi di luar lingkup akan dikonfirmasi terlebih dahulu.
            </p>
            <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (feedback.trim().length >= 5) void act('/feedback', { message: feedback }, 'Feedback terkirim.') }}>
              <label htmlFor="feedback" className="block-label">Feedback terkonsolidasi</label>
              <textarea id="feedback" rows={5} value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={4000} placeholder="Tuliskan semua catatan revisi dalam satu pesan." />
              <div className="btn-row">
                <button type="submit" className="btn btn-ghost" disabled={busy || feedback.trim().length < 5}>Kirim revisi</button>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => confirm('Setujui hasil akhir? Persetujuan akan dicatat.') && act('/approval', {}, 'Terima kasih — persetujuan Anda telah dicatat.')}>Setujui hasil</button>
              </div>
            </form>
          </article>
        )}

        <article className="panel" id="timeline-panel">
          <h2 className="h4">Linimasa</h2>
          <ol className="timeline">
            {data.timeline.map((t, i) => (
              <li key={i}><span className="timeline-dot" aria-hidden="true" /><strong>{t.label}</strong> <span className="small muted">{formatDate(t.at, true)}</span></li>
            ))}
          </ol>
        </article>

        {data.feedback.length > 0 && (
          <article className="panel">
            <h2 className="h4">Riwayat feedback</h2>
            {data.feedback.map((fb) => (
              <div key={fb.id} className="feedback-item">
                <p className="small muted">Putaran {fb.revision_round} · {formatDate(fb.created_at, true)}{fb.within_scope ? '' : ' · di luar lingkup'}</p>
                <p className="prewrap">{fb.message}</p>
              </div>
            ))}
          </article>
        )}
        <p className="small muted">Tautan ini bersifat privat dan memiliki masa berlaku. Jangan bagikan ke pihak lain.</p>
      </div>
    </section>
  )
}
