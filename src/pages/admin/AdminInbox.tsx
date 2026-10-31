import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, ApiFailure, formatDate } from '../../lib/api'
import { Alert } from '../../components/Field'
import { PROJECT_STATUSES, SERVICE_LABELS, STATUS_LABELS, type ProjectStatus, type ServiceType } from '../../../shared/domain'

interface Row { id: string; public_reference: string; customer_name: string; service_type: ServiceType; title: string; status: ProjectStatus; created_at: string; updated_at: string }
interface ListRes { items: Row[]; page: number; pageSize: number; total: number; statusCounts: Record<string, number> }

export function AdminInbox() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const page = Number(params.get('page') ?? '1') || 1
  const [q, setQ] = useState(params.get('q') ?? '')
  const [data, setData] = useState<ListRes | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const qs = new URLSearchParams()
    if (status) qs.set('status', status)
    if (params.get('q')) qs.set('q', params.get('q')!)
    qs.set('page', String(page))
    setLoading(true)
    api<ListRes>(`/admin/projects?${qs}`)
      .then((d) => { setData(d); setError(null) })
      .catch((e) => setError(e instanceof ApiFailure ? e.body.message : 'Gagal memuat'))
      .finally(() => setLoading(false))
  }, [status, page, params])

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k) }
    if (!('page' in patch)) next.delete('page')
    setParams(next)
  }
  const totalAll = data ? Object.values(data.statusCounts).reduce((a, b) => a + b, 0) : 0
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <section>
      <div className="admin-title-row">
        <h1 className="h2">Inbox proyek</h1>
        <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); update({ q }) }}>
          <label htmlFor="search-input" className="sr-only">Cari</label>
          <input id="search-input" placeholder="Cari referensi, judul, nama…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-ghost btn-sm">Cari</button>
        </form>
      </div>
      <nav className="filter-chips" aria-label="Filter status">
        <button className={!status ? 'chip active' : 'chip'} onClick={() => update({ status: '' })}>Semua <span>{totalAll}</span></button>
        {PROJECT_STATUSES.map((s) => (
          <button key={s} className={status === s ? 'chip active' : 'chip'} onClick={() => update({ status: s })}>
            {STATUS_LABELS[s]} <span>{data?.statusCounts[s] ?? 0}</span>
          </button>
        ))}
      </nav>
      {error && <Alert kind="error">{error}</Alert>}
      {loading ? <p className="muted" role="status">Memuat…</p> : data && data.items.length === 0 ? (
        <div className="work-empty"><p>Belum ada proyek{status ? ` dengan status "${STATUS_LABELS[status as ProjectStatus]}"` : ''}.</p></div>
      ) : data && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Referensi</th><th>Proyek</th><th>Klien</th><th>Layanan</th><th>Status</th><th>Masuk</th></tr></thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/admin/projects/${r.id}`} className="mono">{r.public_reference}</Link></td>
                  <td>{r.title}</td>
                  <td>{r.customer_name}</td>
                  <td className="small">{SERVICE_LABELS[r.service_type]}</td>
                  <td><span className={`status-pill s-${r.status}`}>{STATUS_LABELS[r.status]}</span></td>
                  <td className="small muted">{formatDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="pager">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>← Sebelumnya</button>
          <span className="small muted">Hal {page} / {pages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>Berikutnya →</button>
        </div>
      )}
    </section>
  )
}
