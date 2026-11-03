import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api, ApiFailure, formatDate } from '../../lib/api'
import { Alert, Field } from '../../components/Field'
import { STATUS_LABELS, formatIDR, type ProjectStatus } from '../../../shared/domain'

/** Admin UI for docs/78: 50/50 schedule, action runs, CRM / customer 360, catalog & offer versions. */

const errMsg = (e: unknown, fallback: string) => {
  if (!(e instanceof ApiFailure)) return fallback
  const fields = e.body.details?.fields
  return `${e.body.message}${fields ? ': ' + Object.entries(fields).map(([k, v]) => `${k} — ${v}`).join('; ') : ''}`
}

function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    try { setData(await api<T>(path)); setError(null) } catch (e) { setError(errMsg(e, 'Gagal memuat')) }
  }, [path])
  useEffect(() => { void load() }, [load])
  return { data, error, load, setError }
}

// ---------- Schedule (50% DP + 50% pelunasan) ----------
export interface AdminSchedule {
  totalMinor: number; paidMinor: number; remainingMinor: number; status: string
  milestones: { id: string; kind: 'deposit' | 'balance' | 'full'; sequence: number; amountMinor: number; status: string; paidAt: string | null }[]
}
const MILESTONE_LABEL: Record<string, string> = { deposit: 'DP 50% (sebelum produksi)', balance: 'Pelunasan 50% (sebelum file final)', full: 'Pembayaran penuh' }

export function nextUnpaid(s: AdminSchedule | null | undefined) {
  return s?.milestones.find((m) => m.status === 'unpaid') ?? null
}

export function SchedulePanel({ schedule }: { schedule: AdminSchedule | null | undefined }) {
  return (
    <article className="panel" id="admin-schedule">
      <h2 className="h4">Jadwal pembayaran</h2>
      {!schedule ? <p className="small muted">Jadwal dibuat otomatis saat klien menyetujui penawaran.</p> : (
        <>
          <ol className="milestones">
            {schedule.milestones.map((m) => (
              <li key={m.id} className={m.status === 'paid' ? 'is-paid' : ''}>
                <span>{MILESTONE_LABEL[m.kind] ?? m.kind}</span>
                <strong>{formatIDR(m.amountMinor)}</strong>
                <span className="tag">{m.status === 'paid' ? `lunas ${formatDate(m.paidAt)}` : m.status}</span>
              </li>
            ))}
          </ol>
          <p className="small muted">Total {formatIDR(schedule.totalMinor)} · terbayar {formatIDR(schedule.paidMinor)} · sisa {formatIDR(schedule.remainingMinor)}</p>
          <p className="small muted">DP membuka status Antre produksi. Pelunasan wajib sebelum Terkirim dan sebelum klien bisa mengunduh file final.</p>
        </>
      )}
    </article>
  )
}

// ---------- Action runs ----------
interface AdminRun {
  id: string; title: string; objective: string; allowed_operations: string; inputs_ref: string | null; external_side_effect: number
  requires_customer_authorization: number; status: string; authorized_at: string | null; attempts: number; error_code: string | null
  result_summary: string | null; created_at: string; updated_at: string; nextStatuses: string[]
  steps: { id?: string; from_status?: string | null; to_status?: string; note?: string | null; visibility?: string; created_at?: string }[]
}
export const RUN_LABELS: Record<string, string> = {
  draft: 'Draf', awaiting_authorization: 'Menunggu persetujuan klien', queued: 'Antre', manual_in_progress: 'Dikerjakan (manual)',
  review: 'Review', completed: 'Selesai', failed: 'Gagal', cancelled: 'Dibatalkan',
}
const ELIGIBLE = ['queued', 'producing', 'internal_review', 'customer_review', 'revision']

export function ActionRunsPanel({ projectId, projectStatus }: { projectId: string; projectStatus: ProjectStatus }) {
  const { data, error, load, setError } = useLoad<{ runs: AdminRun[] }>(`/admin/projects/${projectId}/actions`)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [f, setF] = useState({ title: '', objective: '', allowedOperations: '', inputsRef: '', externalSideEffect: false, requiresCustomerAuthorization: true })
  const [tr, setTr] = useState<Record<string, { to: string; note: string; visibility: 'public' | 'internal'; resultSummary: string; errorCode: string }>>({})

  async function exec(fn: () => Promise<unknown>, msg: string) {
    setBusy(true); setNotice(null); setError(null)
    try { await fn(); setNotice(msg); await load() } catch (e) { setError(errMsg(e, 'Aksi gagal')) } finally { setBusy(false) }
  }
  function create(e: FormEvent) {
    e.preventDefault()
    void exec(() => api(`/admin/projects/${projectId}/actions`, { method: 'POST', json: { ...f, inputsRef: f.inputsRef || undefined } }), 'Aksi layanan dibuat (draf).')
      .then(() => setF({ title: '', objective: '', allowedOperations: '', inputsRef: '', externalSideEffect: false, requiresCustomerAuthorization: true }))
  }
  const canCreate = ELIGIBLE.includes(projectStatus)

  return (
    <article className="panel" id="admin-action-runs">
      <h2 className="h4">Aksi layanan (human-in-the-loop)</h2>
      <p className="small muted">Setiap aksi dijalankan manual oleh staf. Aksi dengan efek eksternal wajib disetujui klien di portal; staf tidak dapat menyetujui atas nama klien.</p>
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      {!data ? <p className="small muted">Memuat…</p> : data.runs.length === 0 ? <p className="small muted">Belum ada aksi.</p> : (
        <ul className="ops-list">
          {data.runs.map((r) => {
            const st = tr[r.id] ?? { to: '', note: '', visibility: 'internal' as const, resultSummary: '', errorCode: '' }
            const set = (patch: Partial<typeof st>) => setTr({ ...tr, [r.id]: { ...st, ...patch } })
            return (
              <li key={r.id}>
                <div><strong>{r.title}</strong> <span className="tag">{RUN_LABELS[r.status] ?? r.status}</span>
                  {r.external_side_effect ? <span className="tag t-rejected">efek eksternal</span> : null}
                  {r.requires_customer_authorization ? <span className="tag">butuh persetujuan klien</span> : null}</div>
                <div className="small prewrap">{r.objective}</div>
                <div className="small muted">Operasi diizinkan: {r.allowed_operations}</div>
                <div className="small muted">Percobaan {r.attempts} · {r.authorized_at ? `disetujui klien ${formatDate(r.authorized_at, true)}` : 'belum disetujui klien'} · diperbarui {formatDate(r.updated_at, true)}</div>
                {r.error_code && <div className="small">Kode error: <span className="mono">{r.error_code}</span></div>}
                {r.result_summary && <div className="small">Hasil: {r.result_summary}</div>}
                {r.steps.length > 0 && (
                  <ol className="audit small">
                    {r.steps.map((s, i) => <li key={s.id ?? i}>{s.created_at ? formatDate(s.created_at, true) : ''} · {RUN_LABELS[s.to_status ?? ''] ?? s.to_status} {s.visibility === 'public' ? '(terlihat klien)' : '(internal)'}{s.note ? ` — ${s.note}` : ''}</li>)}
                  </ol>
                )}
                {r.nextStatuses.length > 0 && (
                  <form onSubmit={(e) => { e.preventDefault(); if (!st.to) return; void exec(() => api(`/admin/projects/${projectId}/actions/${r.id}/transition`, { method: 'POST', json: { to: st.to, note: st.note || undefined, visibility: st.visibility, resultSummary: st.resultSummary || undefined, errorCode: st.errorCode || undefined } }), `Aksi → ${RUN_LABELS[st.to] ?? st.to}`).then(() => set({ to: '', note: '', resultSummary: '', errorCode: '' })) }}>
                    <div className="grid-2">
                      <Field id={`rt-${r.id}`} label="Pindahkan ke">
                        <select id={`rt-${r.id}`} value={st.to} onChange={(e) => set({ to: e.target.value })}>
                          <option value="">Pilih…</option>
                          {r.nextStatuses.map((s) => <option key={s} value={s}>{RUN_LABELS[s] ?? s}</option>)}
                        </select>
                      </Field>
                      <Field id={`rv-${r.id}`} label="Visibilitas catatan">
                        <select id={`rv-${r.id}`} value={st.visibility} onChange={(e) => set({ visibility: e.target.value as 'public' | 'internal' })}>
                          <option value="internal">Internal</option><option value="public">Terlihat klien</option>
                        </select>
                      </Field>
                    </div>
                    <Field id={`rn-${r.id}`} label="Catatan"><input id={`rn-${r.id}`} value={st.note} onChange={(e) => set({ note: e.target.value })} maxLength={2000} /></Field>
                    {st.to === 'completed' && <Field id={`rs-${r.id}`} label="Ringkasan hasil (terlihat klien)"><input id={`rs-${r.id}`} value={st.resultSummary} onChange={(e) => set({ resultSummary: e.target.value })} maxLength={2000} /></Field>}
                    {st.to === 'failed' && <Field id={`re-${r.id}`} label="Kode error" hint="HURUF_BESAR_ANGKA"><input id={`re-${r.id}`} value={st.errorCode} onChange={(e) => set({ errorCode: e.target.value.toUpperCase() })} maxLength={40} /></Field>}
                    <button className="btn btn-ghost btn-sm" disabled={busy || !st.to}>Terapkan</button>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {canCreate ? (
        <form onSubmit={create}>
          <h3 className="h5">Aksi baru</h3>
          <Field id="arTitle" label="Judul" required><input id="arTitle" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={140} /></Field>
          <Field id="arObj" label="Tujuan" required><textarea id="arObj" rows={2} value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} maxLength={2000} /></Field>
          <Field id="arOps" label="Operasi yang diizinkan (batas lingkup)" required><textarea id="arOps" rows={2} value={f.allowedOperations} onChange={(e) => setF({ ...f, allowedOperations: e.target.value })} maxLength={1000} /></Field>
          <Field id="arIn" label="Referensi input (opsional, tanpa kredensial)"><input id="arIn" value={f.inputsRef} onChange={(e) => setF({ ...f, inputsRef: e.target.value })} maxLength={500} /></Field>
          <label className="check"><input type="checkbox" checked={f.externalSideEffect} onChange={(e) => setF({ ...f, externalSideEffect: e.target.checked })} /> Memiliki efek eksternal (posting, kirim, publikasi)</label>
          <label className="check"><input type="checkbox" checked={f.requiresCustomerAuthorization} onChange={(e) => setF({ ...f, requiresCustomerAuthorization: e.target.checked })} /> Wajib persetujuan klien</label>
          <button className="btn btn-ghost btn-sm btn-block" disabled={busy}>Buat draf aksi</button>
        </form>
      ) : <p className="small muted">Aksi hanya dapat dibuat setelah DP terverifikasi (status Antre s.d. Revisi).</p>}
    </article>
  )
}

// ---------- CRM ----------
interface CustomerListItem { id: string; email: string | null; display_name: string | null; tags: string | null; created_at: string; last_seen_at: string | null; project_count: number }

export function AdminCustomers() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const page = Number(params.get('page') ?? '1') || 1
  const [input, setInput] = useState(q)
  const { data, error } = useLoad<{ items: CustomerListItem[]; page: number; pageSize: number; total: number }>(`/admin/customers?q=${encodeURIComponent(q)}&page=${page}`)
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  return (
    <section id="admin-customers">
      <h1 className="h2">Pelanggan</h1>
      <p className="small muted">Akun pelanggan (Clerk). Cari dengan referensi proyek (AVL-…), email persis, ID internal, atau awalan nama.</p>
      <form className="search-row" onSubmit={(e) => { e.preventDefault(); setParams(input.trim() ? { q: input.trim() } : {}) }}>
        <label htmlFor="cq" className="sr-only">Cari pelanggan</label>
        <input id="cq" value={input} onChange={(e) => setInput(e.target.value)} placeholder="AVL-XXXX-XXXX / email / nama" maxLength={160} />
        <button className="btn btn-primary btn-sm">Cari</button>
      </form>
      {error && <Alert kind="error">{error}</Alert>}
      {!data ? <p className="muted" role="status">Memuat…</p> : data.items.length === 0 ? <p className="muted">Tidak ada pelanggan.</p> : (
        <table className="admin-table">
          <thead><tr><th>Nama</th><th>Email</th><th>Proyek</th><th>Tag</th><th>Terakhir aktif</th></tr></thead>
          <tbody>
            {data.items.map((c) => (
              <tr key={c.id}>
                <td><Link to={`/admin/customers/${c.id}`}>{c.display_name || '(tanpa nama)'}</Link></td>
                <td className="mono small">{c.email ?? '—'}</td>
                <td>{c.project_count}</td>
                <td className="small">{c.tags ? c.tags.split(',').map((t) => <span key={t} className="tag">{t}</span>) : '—'}</td>
                <td className="small">{formatDate(c.last_seen_at ?? c.created_at, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data && pages > 1 && (
        <div className="btn-row">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setParams({ ...(q ? { q } : {}), page: String(page - 1) })}>← Sebelumnya</button>
          <span className="small muted">Hal. {page} / {pages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setParams({ ...(q ? { q } : {}), page: String(page + 1) })}>Berikutnya →</button>
        </div>
      )}
    </section>
  )
}

interface Customer360 {
  customer: { id: string; email: string | null; display_name: string | null; tags: string | null; onboarding_completed_at: string | null; onboarding_skipped_at: string | null; created_at: string; last_seen_at: string | null }
  projects: { id: string; public_reference: string; title: string; status: ProjectStatus; created_at: string }[]
  payments: { id: string; public_reference: string; amount_minor: number; method: string; status: string; confirmed_at: string }[]
  tickets: { id: string; public_reference: string; category: string; status: string; created_at: string }[]
  actionRuns: { id: string; public_reference: string; title: string; status: string; updated_at: string }[]
  notes: { id: string; note: string; created_at: string; author: string | null }[]
  timeline: { event_type: string; to_status: string | null; actor_type: string; created_at: string; public_reference: string }[]
}

export function AdminCustomerDetail() {
  const { id = '' } = useParams()
  const { data, error, load, setError } = useLoad<Customer360>(`/admin/customers/${id}`)
  const [note, setNote] = useState('')
  const [tags, setTags] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  async function exec(fn: () => Promise<unknown>, msg: string) {
    setBusy(true); setNotice(null); setError(null)
    try { await fn(); setNotice(msg); await load() } catch (e) { setError(errMsg(e, 'Aksi gagal')) } finally { setBusy(false) }
  }
  if (!data) return error ? <Alert kind="error">{error}</Alert> : <p className="muted" role="status">Memuat…</p>
  const c = data.customer
  const tagValue = tags ?? (c.tags ?? '').split(',').filter(Boolean).join(', ')
  const paid = data.payments.filter((p) => ['paid', 'manually_confirmed'].includes(p.status)).reduce((s, p) => s + p.amount_minor, 0)
  return (
    <section className="detail" id="admin-customer-360">
      <Link to="/admin/customers" className="small muted">← Pelanggan</Link>
      <h1 className="h2">{c.display_name || '(tanpa nama)'}</h1>
      <p className="small muted mono">{c.email ?? 'email belum diverifikasi'} · ID {c.id}</p>
      {notice && <Alert kind="success">{notice}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      <div className="stat-grid">
        <div className="stat"><span className="small muted">Proyek</span><strong>{data.projects.length}</strong></div>
        <div className="stat"><span className="small muted">Pembayaran terkonfirmasi</span><strong>{formatIDR(paid)}</strong></div>
        <div className="stat"><span className="small muted">Tiket</span><strong>{data.tickets.length}</strong></div>
        <div className="stat"><span className="small muted">Onboarding</span><strong>{c.onboarding_completed_at ? 'Selesai' : c.onboarding_skipped_at ? 'Dilewati' : 'Belum'}</strong></div>
      </div>
      <div className="detail-grid">
        <div className="detail-main">
          <article className="panel">
            <h2 className="h4">Proyek</h2>
            {data.projects.length === 0 ? <p className="small muted">Belum ada proyek.</p> : (
              <ul className="small plain">{data.projects.map((p) => <li key={p.id}><Link to={`/admin/projects/${p.id}`} className="mono">{p.public_reference}</Link> · {p.title} · <span className={`status-pill s-${p.status}`}>{STATUS_LABELS[p.status] ?? p.status}</span></li>)}</ul>
            )}
          </article>
          <article className="panel">
            <h2 className="h4">Pembayaran</h2>
            {data.payments.length === 0 ? <p className="small muted">Belum ada.</p> : (
              <ul className="small plain">{data.payments.map((p) => <li key={p.id}><span className="mono">{p.public_reference}</span> · {formatIDR(p.amount_minor)} · {p.method} · <span className="tag">{p.status}</span> · {formatDate(p.confirmed_at)}</li>)}</ul>
            )}
          </article>
          <article className="panel">
            <h2 className="h4">Aksi layanan &amp; tiket</h2>
            <ul className="small plain">
              {data.actionRuns.map((r) => <li key={r.id}>Aksi · <span className="mono">{r.public_reference}</span> · {r.title} · <span className="tag">{RUN_LABELS[r.status] ?? r.status}</span></li>)}
              {data.tickets.map((t) => <li key={t.id}>Tiket · <span className="mono">{t.public_reference}</span> · {t.category} · <span className="tag">{t.status}</span></li>)}
              {data.actionRuns.length + data.tickets.length === 0 && <li className="muted">Tidak ada.</li>}
            </ul>
          </article>
          <article className="panel">
            <h2 className="h4">Timeline</h2>
            <ol className="audit">{data.timeline.map((e, i) => <li key={i}><span className="small muted">{formatDate(e.created_at, true)}</span> <span className="mono small">{e.public_reference}</span> {e.event_type}{e.to_status ? ` → ${STATUS_LABELS[e.to_status as ProjectStatus] ?? e.to_status}` : ''}</li>)}</ol>
          </article>
        </div>
        <aside className="detail-side">
          <article className="panel">
            <h2 className="h4">Tag</h2>
            <form onSubmit={(e) => { e.preventDefault(); const list = tagValue.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean); void exec(() => api(`/admin/customers/${c.id}/tags`, { method: 'PATCH', json: { tags: list } }), 'Tag disimpan.').then(() => setTags(null)) }}>
              <Field id="ctags" label="Tag (pisahkan koma)" hint="huruf kecil, angka, tanda hubung; maks 10"><input id="ctags" value={tagValue} onChange={(e) => setTags(e.target.value)} /></Field>
              <button className="btn btn-ghost btn-sm btn-block" disabled={busy}>Simpan tag</button>
            </form>
          </article>
          <article className="panel">
            <h2 className="h4">Catatan internal</h2>
            <form onSubmit={(e) => { e.preventDefault(); if (note.trim()) void exec(() => api(`/admin/customers/${c.id}/notes`, { method: 'POST', json: { note: note.trim() } }), 'Catatan disimpan.').then(() => setNote('')) }}>
              <label htmlFor="cnote" className="sr-only">Catatan</label>
              <textarea id="cnote" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Hanya terlihat staf. Jangan tulis kredensial." />
              <button className="btn btn-ghost btn-sm btn-block" disabled={busy || !note.trim()}>Simpan catatan</button>
            </form>
            <ul className="small plain">{data.notes.map((n) => <li key={n.id}><span className="muted">{formatDate(n.created_at, true)} · {n.author ?? 'staf'}</span><div className="prewrap">{n.note}</div></li>)}</ul>
          </article>
        </aside>
      </div>
    </section>
  )
}

// ---------- Catalog ----------
interface AdminCatalogItem {
  id: string; status: string; offerId: string | null; offerStatus: string | null; versionCount: number
  slug: string; type: string; name: string; tagline: string; available: boolean
  category: { slug: string; name: string; lane: string }
  offer: null | { version: number; priceMode: string; priceMinor: number | null; deliverables: string[]; scope?: string[]; inputs?: string[]; revisionRounds?: number | null; deliveryAssumption?: string | null; rightsSummary?: string | null }
}
const PRICE_MODES = ['quote_required', 'fixed', 'starting_at', 'free_demo', 'internal_only'] as const

export function AdminCatalog() {
  const { data, error, load, setError } = useLoad<{ items: AdminCatalogItem[] }>('/admin/catalog')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  async function exec(fn: () => Promise<unknown>, msg: string) {
    setBusy(true); setNotice(null); setError(null)
    try { await fn(); setNotice(msg); await load(); return true } catch (e) { setError(errMsg(e, 'Aksi gagal')); return false } finally { setBusy(false) }
  }
  return (
    <section id="admin-catalog">
      <h1 className="h2">Katalog &amp; offer</h1>
      <p className="small muted">Versi offer tidak pernah diubah; perubahan membuat versi baru. Proyek yang sudah berjalan tetap merujuk versi lamanya. Harga tetap/mulai-dari wajib disertai dasar perhitungan (unit economics). Semua offer memakai kebijakan DP 50% + pelunasan 50%.</p>
      {notice && <Alert kind="success">{notice}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      {!data ? <p className="muted" role="status">Memuat…</p> : (
        <ul className="ops-list">
          {data.items.map((it) => (
            <li key={it.id}>
              <div><strong>{it.name}</strong> <span className="tag">{it.type}</span> <span className="tag">{it.category.name}</span> <span className="tag">item: {it.status}</span> <span className="tag">offer: {it.offerStatus ?? '—'}</span> {it.available ? <span className="tag t-accepted">tersedia</span> : <span className="tag t-rejected">tidak tersedia</span>}</div>
              <div className="small muted">/{it.slug} · {it.offer ? `v${it.offer.version} · ${it.offer.priceMode}${it.offer.priceMinor ? ` · ${formatIDR(it.offer.priceMinor)}` : ''}` : 'belum ada versi'} · {it.versionCount} versi</div>
              <div className="btn-row tight">
                <select aria-label="Status item" value={it.status} disabled={busy} onChange={(e) => void exec(() => api(`/admin/catalog/items/${it.id}`, { method: 'PATCH', json: { itemStatus: e.target.value } }), 'Status item diubah.')}>
                  {['draft', 'published', 'archived'].map((s) => <option key={s} value={s}>item: {s}</option>)}
                </select>
                {it.offerId && (
                  <select aria-label="Status offer" value={it.offerStatus ?? 'active'} disabled={busy} onChange={(e) => void exec(() => api(`/admin/catalog/items/${it.id}`, { method: 'PATCH', json: { offerStatus: e.target.value } }), 'Status offer diubah.')}>
                    {['active', 'unavailable', 'retired'].map((s) => <option key={s} value={s}>offer: {s}</option>)}
                  </select>
                )}
                {it.offerId && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(editing === it.id ? null : it.id)}>{editing === it.id ? 'Tutup' : 'Versi baru'}</button>}
              </div>
              {editing === it.id && it.offerId && (
                <VersionForm item={it} busy={busy} onSubmit={async (body) => { if (await exec(() => api(`/admin/catalog/offers/${it.offerId}/versions`, { method: 'POST', json: body }), 'Versi baru dibuat dan dijadikan versi aktif.')) setEditing(null) }} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function VersionForm({ item, busy, onSubmit }: { item: AdminCatalogItem; busy: boolean; onSubmit: (b: Record<string, unknown>) => void }) {
  const o = item.offer
  const [f, setF] = useState({
    priceMode: o?.priceMode ?? 'quote_required', price: o?.priceMinor ? String(o.priceMinor) : '', pricingEvidence: '',
    deliverables: (o?.deliverables ?? []).join('\n'), scope: (o?.scope ?? []).join('\n'), inputs: (o?.inputs ?? []).join('\n'),
    revisionRounds: o?.revisionRounds != null ? String(o.revisionRounds) : '', deliveryAssumption: o?.deliveryAssumption ?? '', rightsSummary: o?.rightsSummary ?? '',
  })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
  const priced = f.priceMode === 'fixed' || f.priceMode === 'starting_at'
  return (
    <form className="version-form" onSubmit={(e) => {
      e.preventDefault()
      onSubmit({
        priceMode: f.priceMode,
        priceMinor: priced ? Math.round(Number(f.price.replace(/[^\d]/g, '')) || 0) || undefined : undefined,
        pricingEvidence: priced ? f.pricingEvidence || undefined : undefined,
        deliverables: lines(f.deliverables), scope: lines(f.scope), inputs: lines(f.inputs),
        revisionRounds: f.revisionRounds === '' ? undefined : Number(f.revisionRounds),
        deliveryAssumption: f.deliveryAssumption, rightsSummary: f.rightsSummary,
      })
    }}>
      <div className="grid-2">
        <Field id={`pm-${item.id}`} label="Mode harga" required>
          <select id={`pm-${item.id}`} value={f.priceMode} onChange={set('priceMode')}>{PRICE_MODES.map((m) => <option key={m} value={m}>{m}</option>)}</select>
        </Field>
        <Field id={`rr-${item.id}`} label="Revisi termasuk"><input id={`rr-${item.id}`} type="number" min={0} max={10} value={f.revisionRounds} onChange={set('revisionRounds')} /></Field>
      </div>
      {priced && (
        <>
          <Field id={`pr-${item.id}`} label="Harga (IDR)" required><input id={`pr-${item.id}`} inputMode="numeric" value={f.price} onChange={set('price')} /></Field>
          <Field id={`pe-${item.id}`} label="Dasar harga (unit economics)" required hint="Biaya langsung, menit kerja, margin. Tidak tampil ke publik."><textarea id={`pe-${item.id}`} rows={2} value={f.pricingEvidence} onChange={set('pricingEvidence')} maxLength={1000} /></Field>
        </>
      )}
      <Field id={`dl-${item.id}`} label="Deliverable (satu per baris)" required><textarea id={`dl-${item.id}`} rows={3} value={f.deliverables} onChange={set('deliverables')} /></Field>
      <Field id={`sc-${item.id}`} label="Lingkup (satu per baris)" required><textarea id={`sc-${item.id}`} rows={3} value={f.scope} onChange={set('scope')} /></Field>
      <Field id={`in-${item.id}`} label="Input dari klien (satu per baris)" required><textarea id={`in-${item.id}`} rows={3} value={f.inputs} onChange={set('inputs')} /></Field>
      <Field id={`da-${item.id}`} label="Asumsi waktu pengerjaan" required><input id={`da-${item.id}`} value={f.deliveryAssumption} onChange={set('deliveryAssumption')} maxLength={500} /></Field>
      <Field id={`rs-${item.id}`} label="Ringkasan hak penggunaan" required><textarea id={`rs-${item.id}`} rows={2} value={f.rightsSummary} onChange={set('rightsSummary')} maxLength={1000} /></Field>
      <button className="btn btn-primary btn-sm" disabled={busy}>Simpan sebagai versi baru</button>
    </form>
  )
}
