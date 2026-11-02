import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert } from '../components/Field'
import { PaymentPanel, type PaymentInfo } from '../components/PaymentPanel'
import { api, ApiFailure, downloadFile, formatBytes, formatDate, type AssetInfo } from '../lib/api'
import { SERVICE_LABELS, formatIDR, type ProjectStatus, type ServiceType } from '../../shared/domain'

interface CustomerProject {
  reference: string; title: string; serviceType: ServiceType; status: ProjectStatus; statusLabel: string; createdAt: string
  revisionRoundsUsed: number
  quote: null | { id: string; status: string; amountMinor: number; deliverables: string[]; notes: string | null; includedRevisionRounds: number; estimatedDeliveryAt: string | null }
  timeline: { status: string; label: string; at: string }[]
  feedback: { id: string; message: string; revision_round: number; within_scope: number; created_at: string }[]
  deliveryEnabled: boolean
  payment: PaymentInfo
  support: { id: string; category: string; status: string; created_at: string; resolved_at: string | null; resolution_note: string | null }[]
  refunds: { id: string; amount_minor: number; status: string; created_at: string; resolved_at: string | null }[]
  assets: AssetInfo[]
  approvedAssetId: string | null
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
  const [approveId, setApproveId] = useState('')
  const [ticketCat, setTicketCat] = useState('question')
  const [ticketMsg, setTicketMsg] = useState('')

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
  const finals = data.assets.filter((a) => a.kind === 'final')
  const dl = async (a: AssetInfo) => {
    try { await downloadFile(`/projects/${encodeURIComponent(reference)}/assets/${a.id}/download`, a.filename ?? 'avorlune-asset', token) }
    catch (e) { setError(e instanceof ApiFailure ? e.body.message : 'Unduhan gagal') }
  }
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
                <button className="btn btn-primary" disabled={busy} onClick={() => act('/quote/decision', { decision: 'accepted' }, data.payment.onlineEnabled ? 'Penawaran disetujui. Silakan lanjutkan pembayaran.' : 'Penawaran disetujui. Tim kami akan mengonfirmasi langkah pembayaran.')}>Setujui penawaran</button>
                <button className="btn btn-ghost" disabled={busy} onClick={() => confirm('Tolak penawaran ini?') && act('/quote/decision', { decision: 'rejected' }, 'Penawaran ditolak. Tim kami akan menghubungi Anda.')}>Tolak</button>
              </div>
            )}
          </article>
        )}

        {data.payment && <PaymentPanel reference={data.reference} token={token} payment={data.payment} onChanged={load} />}

        {data.assets.length > 0 && (
          <article className="panel" id="files-panel">
            <h2 className="h4">File proyek</h2>
            <ul className="asset-list">
              {data.assets.map((a) => (
                <li key={a.id}>
                  <div>
                    <strong>{a.filename}</strong> <span className={`tag t-${a.kind}`}>{a.kind === 'final' ? 'Final' : 'Preview'} v{a.version}</span>
                    {data.approvedAssetId === a.id && <span className="tag t-accepted">Disetujui</span>}
                    <div className="small muted">{formatBytes(a.sizeBytes)} · {formatDate(a.createdAt, true)}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => dl(a)}>Unduh</button>
                </li>
              ))}
            </ul>
            <p className="small muted">File bersifat privat dan hanya dapat diunduh melalui tautan proyek ini. Hasil dibuat dengan bantuan AI generatif dan diperiksa manusia — lihat <Link to="/ai-licensing">Penggunaan AI &amp; Lisensi Hasil</Link>.</p>
          </article>
        )}

        {data.actions.canSubmitFeedback && (
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
              </div>
            </form>
            <div className="approve-box">
              <h3 className="h5">Persetujuan akhir</h3>
              {data.actions.canApprove ? (
                <>
                  <label htmlFor="approve-asset" className="block-label">File final yang Anda setujui</label>
                  <select id="approve-asset" value={approveId} onChange={(e) => setApproveId(e.target.value)}>
                    <option value="">Pilih file final…</option>
                    {finals.map((a) => <option key={a.id} value={a.id}>{a.filename} (v{a.version})</option>)}
                  </select>
                  <div className="btn-row">
                    <button type="button" className="btn btn-primary" disabled={busy || !approveId} onClick={() => confirm('Setujui file final ini? Persetujuan akan dicatat.') && act('/approval', { assetId: approveId }, 'Terima kasih — persetujuan Anda telah dicatat.')}>Setujui file final</button>
                  </div>
                </>
              ) : (
                <p className="small muted">
                  {data.deliveryEnabled
                    ? 'Persetujuan tersedia setelah file final diunggah oleh tim.'
                    : 'Persetujuan akhir melalui portal belum aktif. Tim kami akan mengirim file final melalui kanal privat dan mengonfirmasi persetujuan bersama Anda secara tertulis.'}
                </p>
              )}
            </div>
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
        {data.refunds?.length > 0 && (
          <article className="panel" id="refund-status">
            <h2 className="h4">Status refund</h2>
            <ul className="small plain">
              {data.refunds.map((r) => <li key={r.id}>{formatIDR(r.amount_minor)} · {r.status === 'requested' ? 'Sedang diproses' : r.status === 'processed' ? `Diproses ${formatDate(r.resolved_at, true)}` : 'Tidak disetujui'}</li>)}
            </ul>
          </article>
        )}

        <article className="panel" id="support-panel">
          <h2 className="h4">Bantuan</h2>
          <p className="small muted">Ada pertanyaan, kendala file, atau permintaan pembatalan/refund? Kirim pesan — tim kami membalas melalui kanal kontak Anda. Lihat <Link to="/refund-policy">Kebijakan Pembatalan &amp; Refund</Link>.</p>
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (ticketMsg.trim().length >= 5) void act('/support', { category: ticketCat, message: ticketMsg }, 'Pesan terkirim. Tim kami akan menghubungi Anda.').then(() => setTicketMsg('')) }}>
            <label htmlFor="ticket-cat" className="block-label">Kategori</label>
            <select id="ticket-cat" value={ticketCat} onChange={(e) => setTicketCat(e.target.value)}>
              <option value="question">Pertanyaan</option>
              <option value="issue">Kendala</option>
              <option value="refund_request">Pembatalan / refund</option>
              <option value="other">Lainnya</option>
            </select>
            <label htmlFor="ticket-msg" className="block-label">Pesan</label>
            <textarea id="ticket-msg" rows={4} maxLength={4000} value={ticketMsg} onChange={(e) => setTicketMsg(e.target.value)} />
            <div className="btn-row"><button type="submit" className="btn btn-ghost" disabled={busy || ticketMsg.trim().length < 5}>Kirim</button></div>
          </form>
          {data.support?.length > 0 && (
            <ul className="small plain">
              {data.support.map((t) => <li key={t.id}>{formatDate(t.created_at, true)} · {t.status === 'open' ? 'Menunggu tanggapan' : `Selesai — ${t.resolution_note ?? ''}`}</li>)}
            </ul>
          )}
        </article>

        <p className="small muted">Tautan ini bersifat privat dan memiliki masa berlaku. Jangan bagikan ke pihak lain.</p>
      </div>
    </section>
  )
}
