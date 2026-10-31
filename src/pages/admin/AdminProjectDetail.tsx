import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiFailure, formatDate } from '../../lib/api'
import { Alert, Field } from '../../components/Field'
import {
  BUDGET_LABELS, DEADLINE_LABELS, REASON_REQUIRED_TARGETS, SERVICE_LABELS, STATUS_LABELS, TRANSITIONS, formatIDR,
  type ProjectStatus, type ServiceType,
} from '../../../shared/domain'

interface Detail {
  project: {
    id: string; public_reference: string; customer_name: string; contact_method: string; customer_contact: string; service_type: ServiceType
    title: string; objective: string; intended_use: string; requested_deadline: string | null; status: ProjectStatus; revision_rounds_used: number
    created_at: string; updated_at: string
    brief: { description: string; desiredFormat: string; deadlinePreference: keyof typeof DEADLINE_LABELS; brandUrl: string | null; referenceLinks: string[]; budgetRange: keyof typeof BUDGET_LABELS; consentAt: string; rightsConfirmedAt: string }
  }
  quotes: { id: string; status: string; amount_minor: number; included_revision_rounds: number; estimated_delivery_at: string | null; created_at: string; accepted_at: string | null; scope: { deliverables: string[]; notes: string | null } }[]
  payments: { id: string; amount_minor: number; method: string; provider_reference: string | null; status: string; confirmed_at: string }[]
  feedback: { id: string; message: string; revision_round: number; within_scope: number; submitted_via: string; created_at: string }[]
  events: { id: string; event_type: string; actor_type: string; actor_email: string | null; from_status: string | null; to_status: string | null; metadata: Record<string, unknown>; created_at: string }[]
}

const EVENT_LABELS: Record<string, string> = {
  inquiry_created: 'Brief masuk', status_changed: 'Status diubah', quote_sent: 'Penawaran dikirim', quote_drafted: 'Draf penawaran',
  quote_accepted: 'Penawaran disetujui klien', quote_rejected: 'Penawaran ditolak klien', payment_manually_confirmed: 'Pembayaran dikonfirmasi manual',
  internal_note: 'Catatan internal', access_link_issued: 'Tautan klien dibuat', access_link_rotated: 'Tautan klien dirotasi (lama dicabut)',
}

export function AdminProjectDetail() {
  const { id = '' } = useParams()
  const [d, setD] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null)

  const load = useCallback(async () => {
    try { setD(await api<Detail>(`/admin/projects/${id}`)); setError(null) }
    catch (e) { setError(e instanceof ApiFailure ? e.body.message : 'Gagal memuat') }
  }, [id])
  useEffect(() => { void load() }, [load])

  async function run<T>(fn: () => Promise<T>, msg: string) {
    setBusy(true); setNotice(null); setError(null)
    try { const r = await fn(); setNotice(msg); await load(); return r }
    catch (e) {
      const f = e instanceof ApiFailure ? e : null
      const fields = f?.body.details?.fields
      setError(f ? `${f.body.message}${fields ? ': ' + Object.entries(fields).map(([k, v]) => `${k} — ${v}`).join('; ') : ''}` : 'Aksi gagal')
    } finally { setBusy(false) }
  }

  if (!d) return error ? <Alert kind="error">{error}</Alert> : <p className="muted" role="status">Memuat…</p>
  const p = d.project
  const next = TRANSITIONS[p.status]

  return (
    <section className="detail">
      <Link to="/admin" className="small muted">← Inbox</Link>
      <div className="admin-title-row">
        <div>
          <p className="eyebrow mono">{p.public_reference}</p>
          <h1 className="h2">{p.title}</h1>
          <p className="muted small">{SERVICE_LABELS[p.service_type]} · masuk {formatDate(p.created_at, true)}</p>
        </div>
        <span className={`status-pill lg s-${p.status}`}>{STATUS_LABELS[p.status]}</span>
      </div>
      {notice && <Alert kind="success">{notice}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      <div className="detail-grid">
        <div className="detail-main">
          <article className="panel">
            <h2 className="h4">Brief</h2>
            <dl className="kv">
              <dt>Klien</dt><dd>{p.customer_name}</dd>
              <dt>Kontak ({p.contact_method})</dt><dd className="mono">{p.customer_contact}</dd>
              <dt>Tujuan</dt><dd className="prewrap">{p.objective}</dd>
              <dt>Deskripsi</dt><dd className="prewrap">{p.brief.description}</dd>
              <dt>Penggunaan</dt><dd>{p.intended_use}</dd>
              <dt>Format</dt><dd>{p.brief.desiredFormat}</dd>
              <dt>Tenggat</dt><dd>{DEADLINE_LABELS[p.brief.deadlinePreference]}{p.requested_deadline ? ` — ${formatDate(p.requested_deadline)}` : ''}</dd>
              <dt>Anggaran</dt><dd>{BUDGET_LABELS[p.brief.budgetRange]}</dd>
              {p.brief.brandUrl && <><dt>Brand URL</dt><dd><a href={p.brief.brandUrl} target="_blank" rel="noopener noreferrer nofollow">{p.brief.brandUrl}</a></dd></>}
              {p.brief.referenceLinks.length > 0 && <><dt>Referensi</dt><dd>{p.brief.referenceLinks.map((l) => <div key={l}><a href={l} target="_blank" rel="noopener noreferrer nofollow">{l}</a></div>)}</dd></>}
              <dt>Persetujuan</dt><dd className="small">Privasi & hak materi dikonfirmasi {formatDate(p.brief.consentAt, true)}</dd>
            </dl>
          </article>

          <QuotePanel d={d} busy={busy} onCreate={(body) => run(() => api(`/admin/projects/${id}/quotes`, { method: 'POST', json: body }), body.status === 'sent' ? 'Penawaran dikirim.' : 'Draf disimpan.')} />

          <article className="panel">
            <h2 className="h4">Feedback klien</h2>
            {d.feedback.length === 0 ? <p className="muted small">Belum ada feedback.</p> : d.feedback.map((f) => (
              <div key={f.id} className="feedback-item">
                <p className="small muted">Putaran {f.revision_round} · {formatDate(f.created_at, true)} · {f.within_scope ? 'dalam lingkup' : <strong>di luar lingkup</strong>}</p>
                <p className="prewrap">{f.message}</p>
              </div>
            ))}
          </article>

          <article className="panel">
            <h2 className="h4">Riwayat audit</h2>
            <ol className="audit">
              {d.events.map((e) => (
                <li key={e.id}>
                  <span className="small muted">{formatDate(e.created_at, true)}</span>
                  <strong>{EVENT_LABELS[e.event_type] ?? e.event_type}</strong>
                  {e.from_status && e.to_status && <span className="small"> {STATUS_LABELS[e.from_status as ProjectStatus]} → {STATUS_LABELS[e.to_status as ProjectStatus]}</span>}
                  <span className="small muted"> · {e.actor_type === 'admin' ? e.actor_email ?? 'admin' : e.actor_type === 'customer' ? 'klien' : 'sistem'}</span>
                  {typeof e.metadata.reason === 'string' && <div className="small prewrap">Alasan: {e.metadata.reason}</div>}
                  {typeof e.metadata.note === 'string' && <div className="small prewrap">{e.metadata.note}</div>}
                  {typeof e.metadata.amountMinor === 'number' && <div className="small">{formatIDR(e.metadata.amountMinor)}</div>}
                </li>
              ))}
            </ol>
          </article>
        </div>

        <aside className="detail-side">
          <StatusPanel status={p.status} next={next} busy={busy} onChange={(toStatus, reason) => run(() => api(`/admin/projects/${id}/status`, { method: 'PATCH', json: { toStatus, reason: reason || undefined } }), `Status → ${STATUS_LABELS[toStatus]}`)} />

          <PaymentPanel payments={d.payments} busy={busy} onConfirm={(body) => run(() => api(`/admin/projects/${id}/payments/confirm`, { method: 'POST', json: body }), 'Pembayaran dicatat.')} />

          <article className="panel">
            <h2 className="h4">Tautan klien</h2>
            <p className="small muted">Tautan privat berlaku 30 hari. Token hanya ditampilkan sekali dan tidak disimpan di server.</p>
            <div className="btn-col">
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={async () => { const r = await run(() => api<{ url: string; expiresAt: string }>(`/admin/projects/${id}/access-link`, { method: 'POST', json: {} }), 'Tautan dibuat.'); if (r) setLink(r) }}>Buat tautan</button>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={async () => { if (!confirm('Cabut semua tautan lama dan buat yang baru?')) return; const r = await run(() => api<{ url: string; expiresAt: string }>(`/admin/projects/${id}/access-link?revokePrevious=true`, { method: 'POST', json: {} }), 'Tautan lama dicabut, tautan baru dibuat.'); if (r) setLink(r) }}>Cabut & buat baru</button>
            </div>
            {link && (
              <div className="link-box">
                <input readOnly value={link.url} aria-label="Tautan klien" onFocus={(e) => e.currentTarget.select()} />
                <button className="btn btn-primary btn-sm" onClick={() => navigator.clipboard?.writeText(link.url)}>Salin</button>
                <p className="small muted">Berlaku sampai {formatDate(link.expiresAt, true)}</p>
              </div>
            )}
          </article>

          <NotePanel busy={busy} onSave={(note) => run(() => api(`/admin/projects/${id}/events`, { method: 'POST', json: { note } }), 'Catatan disimpan.')} />

          <article className="panel">
            <h2 className="h4">Ekspor</h2>
            <button className="btn btn-ghost btn-sm" onClick={async () => {
              const data = await api(`/admin/projects/${id}/export`)
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${p.public_reference}.json`; a.click(); URL.revokeObjectURL(a.href)
            }}>Unduh JSON</button>
          </article>
        </aside>
      </div>
    </section>
  )
}

function StatusPanel({ status, next, busy, onChange }: { status: ProjectStatus; next: readonly ProjectStatus[]; busy: boolean; onChange: (s: ProjectStatus, reason: string) => void }) {
  const [to, setTo] = useState<ProjectStatus | ''>('')
  const [reason, setReason] = useState('')
  const needReason = to !== '' && (REASON_REQUIRED_TARGETS.includes(to) || (to === 'queued'))
  return (
    <article className="panel">
      <h2 className="h4">Status</h2>
      {next.length === 0 ? <p className="muted small">Status final — tidak ada transisi lanjutan.</p> : (
        <form onSubmit={(e) => { e.preventDefault(); if (to) { onChange(to, reason); setTo(''); setReason('') } }}>
          <Field id="toStatus" label="Pindahkan ke" required>
            <select id="toStatus" value={to} onChange={(e) => setTo(e.target.value as ProjectStatus)}>
              <option value="">Pilih…</option>
              {next.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </Field>
          {needReason && (
            <Field id="reason" label="Alasan" required={to !== 'queued'} hint={to === 'queued' ? 'Wajib jika pembayaran belum dikonfirmasi (pengecualian).' : to === 'approved' ? 'Mis. persetujuan klien via email/WA tanggal …' : undefined}>
              <textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
            </Field>
          )}
          <button className="btn btn-primary btn-sm btn-block" disabled={busy || !to}>Terapkan</button>
        </form>
      )}
      <p className="small muted">Saat ini: {STATUS_LABELS[status]}</p>
    </article>
  )
}

function QuotePanel({ d, busy, onCreate }: { d: Detail; busy: boolean; onCreate: (b: { amountMinor: number; deliverables: string[]; includedRevisionRounds: number; estimatedDeliveryAt?: string; notes?: string; status: 'draft' | 'sent' }) => void }) {
  const [amount, setAmount] = useState('')
  const [deliverables, setDeliverables] = useState('')
  const [rounds, setRounds] = useState('2')
  const [eta, setEta] = useState('')
  const [notes, setNotes] = useState('')
  const canCreate = ['qualifying', 'quoted'].includes(d.project.status)
  const submit = (status: 'draft' | 'sent') => (e?: FormEvent) => {
    e?.preventDefault()
    onCreate({
      amountMinor: Math.round(Number(amount.replace(/[^\d]/g, '')) || 0),
      deliverables: deliverables.split('\n').map((s) => s.trim()).filter(Boolean),
      includedRevisionRounds: Number(rounds) || 0,
      estimatedDeliveryAt: eta || undefined,
      notes: notes || undefined,
      status,
    })
  }
  return (
    <article className="panel">
      <h2 className="h4">Penawaran & lingkup</h2>
      {d.quotes.length > 0 && (
        <ul className="quote-list">
          {d.quotes.map((q) => (
            <li key={q.id}>
              <div><strong>{formatIDR(q.amount_minor)}</strong> <span className={`tag t-${q.status}`}>{q.status}</span></div>
              <div className="small muted">{q.included_revision_rounds} revisi · ETA {formatDate(q.estimated_delivery_at)} · dibuat {formatDate(q.created_at)}</div>
              <ul className="small">{q.scope.deliverables.map((x) => <li key={x}>{x}</li>)}</ul>
            </li>
          ))}
        </ul>
      )}
      {canCreate ? (
        <form onSubmit={submit('sent')} className="quote-form">
          <div className="grid-2">
            <Field id="amount" label="Harga (IDR)" required hint="Bilangan bulat rupiah">
              <input id="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </Field>
            <Field id="rounds" label="Revisi termasuk" required>
              <input id="rounds" type="number" min={0} max={10} value={rounds} onChange={(e) => setRounds(e.target.value)} />
            </Field>
          </div>
          <Field id="deliverables" label="Deliverable" required hint="Satu per baris (jumlah, format, rasio, durasi).">
            <textarea id="deliverables" rows={4} value={deliverables} onChange={(e) => setDeliverables(e.target.value)} />
          </Field>
          <div className="grid-2">
            <Field id="eta" label="Estimasi selesai">
              <input id="eta" type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
            </Field>
          </div>
          <Field id="notes" label="Catatan (ketentuan penggunaan, pengecualian)">
            <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </Field>
          <div className="btn-row">
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => submit('draft')()}>Simpan draf</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Kirim penawaran</button>
          </div>
          <p className="small muted">Setelah dikirim, pindahkan status ke "Penawaran dikirim" dan bagikan tautan klien.</p>
        </form>
      ) : <p className="small muted">Penawaran baru hanya dapat dibuat pada tahap Kualifikasi / Penawaran dikirim.</p>}
    </article>
  )
}

function PaymentPanel({ payments, busy, onConfirm }: { payments: Detail['payments']; busy: boolean; onConfirm: (b: { amountMinor: number; method: string; providerReference?: string }) => void }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Transfer bank')
  const [ref, setRef] = useState('')
  return (
    <article className="panel">
      <h2 className="h4">Pembayaran</h2>
      {payments.length === 0 ? <p className="small muted">Belum ada pembayaran tercatat.</p> : (
        <ul className="small plain">{payments.map((p) => <li key={p.id}>{formatIDR(p.amount_minor)} · {p.method} · {formatDate(p.confirmed_at)} <span className="tag">{p.status}</span></li>)}</ul>
      )}
      <form onSubmit={(e) => { e.preventDefault(); if (!confirm('Konfirmasi bahwa dana benar-benar sudah diterima?')) return; onConfirm({ amountMinor: Math.round(Number(amount.replace(/[^\d]/g, '')) || 0), method, providerReference: ref || undefined }); setAmount(''); setRef('') }}>
        <Field id="payAmount" label="Jumlah diterima (IDR)" required><input id="payAmount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field id="payMethod" label="Metode" required><input id="payMethod" value={method} onChange={(e) => setMethod(e.target.value)} /></Field>
        <Field id="payRef" label="Referensi transaksi"><input id="payRef" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        <button className="btn btn-ghost btn-sm btn-block" disabled={busy || !amount}>Catat konfirmasi manual</button>
      </form>
    </article>
  )
}

function NotePanel({ busy, onSave }: { busy: boolean; onSave: (n: string) => void }) {
  const [note, setNote] = useState('')
  return (
    <article className="panel">
      <h2 className="h4">Catatan internal</h2>
      <form onSubmit={(e) => { e.preventDefault(); if (note.trim()) { onSave(note.trim()); setNote('') } }}>
        <label htmlFor="note" className="sr-only">Catatan</label>
        <textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Hanya terlihat oleh staf. Jangan tulis kredensial." />
        <button className="btn btn-ghost btn-sm btn-block" disabled={busy || !note.trim()}>Simpan catatan</button>
      </form>
    </article>
  )
}
