import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiFailure, formatDate } from '../../lib/api'
import { Alert, Field } from '../../components/Field'
import { STATUS_LABELS, formatIDR, type ProjectStatus } from '../../../shared/domain'

const errMsg = (e: unknown, fallback: string) => (e instanceof ApiFailure ? e.body.message : fallback)

function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    try { setData(await api<T>(path)); setError(null) } catch (e) { setError(errMsg(e, 'Gagal memuat')) }
  }, [path])
  useEffect(() => { void load() }, [load])
  return { data, error, load, setError }
}

// ---------- Dashboard ----------
interface Dash {
  projectsByStatus: Record<string, number>; revenueConfirmedMinor: number; refundsProcessedMinor: number; openSupportTickets: number
  pendingNotifications: number; failedNotifications: number; pendingRefunds: number; openPaymentOrders: number; approvedAwaitingLicenseClearance: number
  settings: { environment: string | null; privateDelivery: boolean; duitkuConfigured: boolean; duitkuEnv: string | null; checkoutEnabled: boolean; emailSending: boolean }
}

export function AdminDashboard() {
  const { data, error } = useLoad<Dash>('/admin/dashboard')
  if (error) return <Alert kind="error">{error}</Alert>
  if (!data) return <p className="muted" role="status">Memuat…</p>
  const s = data.settings
  const onOff = (v: boolean) => (v ? 'Aktif' : 'Nonaktif')
  return (
    <section id="admin-dashboard">
      <h1 className="h2">Dashboard</h1>
      <div className="stat-grid">
        <div className="stat"><span className="small muted">Pendapatan terkonfirmasi</span><strong>{formatIDR(data.revenueConfirmedMinor)}</strong></div>
        <div className="stat"><span className="small muted">Refund diproses</span><strong>{formatIDR(data.refundsProcessedMinor)}</strong></div>
        <div className="stat"><span className="small muted">Tiket dukungan terbuka</span><strong><Link to="/admin/support">{data.openSupportTickets}</Link></strong></div>
        <div className="stat"><span className="small muted">Notifikasi menunggu / gagal</span><strong><Link to="/admin/notifications">{data.pendingNotifications} / {data.failedNotifications}</Link></strong></div>
        <div className="stat"><span className="small muted">Refund menunggu keputusan</span><strong>{data.pendingRefunds}</strong></div>
        <div className="stat"><span className="small muted">Invoice Duitku terbuka</span><strong>{data.openPaymentOrders}</strong></div>
        <div className="stat"><span className="small muted">Disetujui, belum clear lisensi</span><strong>{data.approvedAwaitingLicenseClearance}</strong></div>
      </div>
      <article className="panel">
        <h2 className="h4">Antrean per status</h2>
        <ul className="small plain">
          {Object.entries(data.projectsByStatus).length === 0 ? <li className="muted">Belum ada proyek.</li> :
            Object.entries(data.projectsByStatus).map(([k, n]) => <li key={k}><Link to={`/admin?status=${k}`}>{STATUS_LABELS[k as ProjectStatus] ?? k}</Link>: {n}</li>)}
        </ul>
      </article>
      <article className="panel" id="ops-settings">
        <h2 className="h4">Pengaturan operasional (hanya status, tanpa nilai rahasia)</h2>
        <dl className="kv small">
          <dt>Lingkungan</dt><dd>{s.environment ?? '—'}</dd>
          <dt>Penyimpanan privat R2</dt><dd>{onOff(s.privateDelivery)}</dd>
          <dt>Duitku</dt><dd>{s.duitkuConfigured ? `Terkonfigurasi (${s.duitkuEnv})` : 'Belum dikonfigurasi'}</dd>
          <dt>Checkout online</dt><dd>{onOff(s.checkoutEnabled)}</dd>
          <dt>Email otomatis</dt><dd>{onOff(s.emailSending)}</dd>
        </dl>
        <p className="small muted">Perubahan pengaturan ini dilakukan melalui konfigurasi Cloudflare oleh pemilik, bukan dari panel ini.</p>
      </article>
    </section>
  )
}

// ---------- Notifications ----------
interface Notif { id: string; project_id: string; public_reference: string; event: string; channel: string; subject: string; body: string; status: string; attempts: number; last_error: string | null; created_at: string; sent_at: string | null }

export function AdminNotifications() {
  const [status, setStatus] = useState('pending')
  const { data, error, load, setError } = useLoad<{ emailSending: boolean; notifications: Notif[] }>(`/admin/notifications?status=${status}`)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true); setNotice(null)
    try { await fn(); setNotice(msg); await load() } catch (e) { setError(errMsg(e, 'Aksi gagal')) } finally { setBusy(false) }
  }
  const copy = async (n: Notif) => { await navigator.clipboard?.writeText(`${n.subject}\n\n${n.body}`); setNotice('Teks disalin.') }
  return (
    <section id="admin-notifications">
      <h1 className="h2">Notifikasi</h1>
      <p className="small muted">
        {data?.emailSending ? 'Email otomatis aktif.' : 'Email otomatis belum aktif — kirim manual lewat WhatsApp/email, lalu tandai “Terkirim manual”.'}
      </p>
      {notice && <Alert kind="success">{notice}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      <div className="btn-row">
        {['pending', 'failed', 'manual_sent', 'sent', 'cancelled'].map((s) => (
          <button key={s} className={`btn btn-sm ${s === status ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStatus(s)}>{s}</button>
        ))}
        {data?.emailSending && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(() => api('/admin/notifications/process', { method: 'POST', json: {} }), 'Antrean diproses.')}>Proses antrean email</button>}
      </div>
      <ul className="ops-list">
        {(data?.notifications ?? []).map((n) => (
          <li key={n.id}>
            <div className="small muted"><Link to={`/admin/projects/${n.project_id}`} className="mono">{n.public_reference}</Link> · {n.event} · {n.channel} · {formatDate(n.created_at, true)}{n.attempts ? ` · percobaan ${n.attempts}` : ''}{n.last_error ? ` · ${n.last_error}` : ''}</div>
            <strong>{n.subject}</strong>
            <p className="prewrap small">{n.body}</p>
            <div className="btn-row tight">
              <button className="btn btn-ghost btn-sm" onClick={() => void copy(n)}>Salin teks</button>
              {['pending', 'failed'].includes(n.status) && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(() => api(`/admin/notifications/${n.id}/manual-sent`, { method: 'POST', json: {} }), 'Ditandai terkirim manual.')}>Terkirim manual</button>}
              {n.status === 'failed' && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(() => api(`/admin/notifications/${n.id}/retry`, { method: 'POST', json: {} }), 'Dijadwalkan ulang.')}>Coba lagi</button>}
              {['pending', 'failed'].includes(n.status) && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(() => api(`/admin/notifications/${n.id}/cancel`, { method: 'POST', json: {} }), 'Dibatalkan.')}>Batalkan</button>}
            </div>
          </li>
        ))}
        {data && data.notifications.length === 0 && <li className="muted small">Tidak ada notifikasi dengan status ini.</li>}
      </ul>
    </section>
  )
}

// ---------- Support ----------
interface Ticket { id: string; project_id: string; public_reference: string; title: string; category: string; message: string; status: string; resolution_note: string | null; created_at: string; resolved_at: string | null }
const CATEGORY_LABELS: Record<string, string> = { question: 'Pertanyaan', issue: 'Masalah', refund_request: 'Permintaan refund', other: 'Lainnya' }

export function AdminSupport() {
  const [status, setStatus] = useState('open')
  const { data, error, load, setError } = useLoad<{ tickets: Ticket[] }>(`/admin/support?status=${status}`)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const resolve = async (t: Ticket) => {
    setBusy(true)
    try { await api(`/admin/support/${t.id}/resolve`, { method: 'POST', json: { note: notes[t.id] ?? '' } }); await load() }
    catch (e) { setError(errMsg(e, 'Gagal')) } finally { setBusy(false) }
  }
  return (
    <section id="admin-support">
      <h1 className="h2">Dukungan</h1>
      {error && <Alert kind="error">{error}</Alert>}
      <div className="btn-row">
        {['open', 'resolved'].map((s) => <button key={s} className={`btn btn-sm ${s === status ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStatus(s)}>{s === 'open' ? 'Terbuka' : 'Selesai'}</button>)}
      </div>
      <ul className="ops-list">
        {(data?.tickets ?? []).map((t) => (
          <li key={t.id}>
            <div className="small muted"><Link to={`/admin/projects/${t.project_id}`} className="mono">{t.public_reference}</Link> · {CATEGORY_LABELS[t.category] ?? t.category} · {formatDate(t.created_at, true)}</div>
            <p className="prewrap">{t.message}</p>
            {t.status === 'open' ? (
              <form onSubmit={(e) => { e.preventDefault(); void resolve(t) }}>
                <label htmlFor={`note-${t.id}`} className="sr-only">Catatan penyelesaian</label>
                <input id={`note-${t.id}`} placeholder="Catatan penyelesaian (terlihat oleh klien)" value={notes[t.id] ?? ''} onChange={(e) => setNotes({ ...notes, [t.id]: e.target.value })} maxLength={1000} />
                <button className="btn btn-ghost btn-sm" disabled={busy || (notes[t.id] ?? '').trim().length < 2}>Tandai selesai</button>
              </form>
            ) : <p className="small muted">Selesai {formatDate(t.resolved_at, true)} — {t.resolution_note}</p>}
          </li>
        ))}
        {data && data.tickets.length === 0 && <li className="muted small">Tidak ada tiket.</li>}
      </ul>
    </section>
  )
}

// ---------- Providers ----------
interface Provider { slug: string; name: string; kind: string; terms_url: string | null; terms_checked_at: string | null; commercial_use: string; api_available: string; notes: string | null; updated_at: string }

export function AdminProviders() {
  const { data, error, load, setError } = useLoad<{ providers: Provider[] }>('/admin/providers')
  const [edit, setEdit] = useState<Record<string, Partial<{ commercialUse: string; apiAvailable: string; notes: string; termsUrl: string; termsCheckedAt: string }>>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const save = async (slug: string) => {
    const body = Object.fromEntries(Object.entries(edit[slug] ?? {}).filter(([, v]) => v !== '' && v !== undefined))
    try { await api(`/admin/providers/${slug}`, { method: 'PATCH', json: body }); setNotice('Provider diperbarui.'); setEdit({ ...edit, [slug]: {} }); await load() }
    catch (e) { setError(errMsg(e, 'Gagal menyimpan')) }
  }
  return (
    <section id="admin-providers">
      <h1 className="h2">Provider &amp; lisensi</h1>
      <p className="small muted">Registri kemampuan dan ketentuan provider. Jangan menandai “allowed” tanpa membaca ketentuan terbaru dan mencatat tanggalnya.</p>
      {notice && <Alert kind="success">{notice}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      {(data?.providers ?? []).map((p) => {
        const e = edit[p.slug] ?? {}
        return (
          <article className="panel" key={p.slug}>
            <h2 className="h4">{p.name} <span className="tag">{p.kind}</span></h2>
            <dl className="kv small">
              <dt>Penggunaan komersial</dt><dd>{p.commercial_use}</dd>
              <dt>API tersedia</dt><dd>{p.api_available}</dd>
              <dt>Ketentuan</dt><dd>{p.terms_url ? <a href={p.terms_url} target="_blank" rel="noreferrer noopener">{p.terms_url}</a> : '—'} {p.terms_checked_at ? `(dicek ${formatDate(p.terms_checked_at)})` : ''}</dd>
              <dt>Catatan</dt><dd className="prewrap">{p.notes ?? '—'}</dd>
            </dl>
            <form onSubmit={(ev) => { ev.preventDefault(); void save(p.slug) }}>
              <Field id={`cu-${p.slug}`} label="Ubah penggunaan komersial">
                <select id={`cu-${p.slug}`} value={e.commercialUse ?? ''} onChange={(x) => setEdit({ ...edit, [p.slug]: { ...e, commercialUse: x.target.value } })}>
                  <option value="">(tidak berubah)</option>
                  {['unverified', 'allowed', 'restricted', 'not_allowed'].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
              <Field id={`tc-${p.slug}`} label="Tanggal ketentuan dicek"><input id={`tc-${p.slug}`} type="date" value={e.termsCheckedAt ?? ''} onChange={(x) => setEdit({ ...edit, [p.slug]: { ...e, termsCheckedAt: x.target.value } })} /></Field>
              <Field id={`nt-${p.slug}`} label="Catatan (mis. paket langganan aktif, bukti)"><textarea id={`nt-${p.slug}`} rows={3} maxLength={2000} value={e.notes ?? ''} onChange={(x) => setEdit({ ...edit, [p.slug]: { ...e, notes: x.target.value } })} /></Field>
              <button className="btn btn-ghost btn-sm" disabled={Object.values(e).every((v) => !v)}>Simpan</button>
            </form>
          </article>
        )
      })}
    </section>
  )
}
