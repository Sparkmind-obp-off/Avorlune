import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/SiteLayout'
import { Alert } from '../components/Field'
import { api, ApiFailure } from '../lib/api'
import { formatIDR } from '../../shared/domain'
import { NotFoundPage } from './NotFoundPage'

export interface CatalogOffer {
  version: number; priceMode: string; priceMinor: number | null; currency: string; deliverables: string[]
  scope?: string[]; inputs?: string[]; revisionRounds?: number | null; deliveryAssumption?: string; rightsSummary?: string
}
export interface CatalogItem {
  slug: string; type: string; name: string; tagline: string; summary: string
  category: { slug: string; name: string; lane: string }; available: boolean; offer: CatalogOffer | null
}

export const TYPE_LABELS: Record<string, string> = {
  creative_service: 'Produksi kreatif', digital_product: 'Produk digital', action_service: 'Aksi layanan', bundle: 'Bundel', custom_project: 'Proyek kustom',
}
const LANES: { key: string; label: string }[] = [
  { key: '', label: 'Semua' },
  { key: 'creative_production', label: 'AI Creative Production' },
  { key: 'action_services', label: 'AI Action Services' },
  { key: 'creative_products', label: 'AI Creative Products' },
]

export function priceText(o: CatalogOffer | null) {
  if (!o) return 'Belum tersedia'
  if (o.priceMode === 'fixed' && o.priceMinor) return formatIDR(o.priceMinor)
  if (o.priceMode === 'starting_at' && o.priceMinor) return `Mulai ${formatIDR(o.priceMinor)}`
  if (o.priceMode === 'free_demo') return 'Demo gratis'
  return 'Harga melalui penawaran'
}

export function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const lane = params.get('lane') ?? ''
  const [q, setQ] = useState(params.get('q') ?? '')
  const [items, setItems] = useState<CatalogItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const qs = new URLSearchParams()
    if (lane) qs.set('lane', lane)
    if (params.get('q')) qs.set('q', params.get('q')!)
    api<{ items: CatalogItem[] }>(`/catalog?${qs}`).then((r) => { setItems(r.items); setError(null) }).catch((e) => setError(e instanceof ApiFailure ? e.body.message : 'Gagal memuat katalog'))
  }, [lane, params])
  const update = (k: string, v: string) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n) }

  return (
    <>
      <PageHeader eyebrow="Katalog" title="Layanan & produk AVORLUNE" intro="Semua dikerjakan dan diperiksa oleh tim kami. Harga ditetapkan dalam penawaran tertulis sebelum ada kewajiban membayar." />
      <section className="section"><div className="container" id="catalog">
        <div className="catalog-toolbar">
          <div className="segmented" role="tablist" aria-label="Kategori">
            {LANES.map((l) => <button key={l.key} role="tab" aria-selected={lane === l.key} className={lane === l.key ? 'is-selected' : ''} onClick={() => update('lane', l.key)}>{l.label}</button>)}
          </div>
          <form role="search" onSubmit={(e) => { e.preventDefault(); update('q', q.trim()) }}>
            <label htmlFor="catalog-search" className="sr-only">Cari layanan</label>
            <input id="catalog-search" type="search" placeholder="Cari layanan…" value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} />
          </form>
        </div>
        {error && <Alert kind="error">{error}</Alert>}
        {!items && !error && <p className="muted" role="status">Memuat…</p>}
        {items && items.length === 0 && (
          <p className="muted">{lane === 'creative_products' ? 'Produk digital belum tersedia. Kami hanya menerbitkan produk yang hak dan lisensinya sudah jelas.' : 'Tidak ada hasil.'}</p>
        )}
        <div className="card-grid two">
          {(items ?? []).map((it) => (
            <article key={it.slug} className="service-card catalog-card">
              <p className="eyebrow">{TYPE_LABELS[it.type] ?? it.type} · {it.category.name}</p>
              <h2 className="h3">{it.name}</h2>
              <p className="muted">{it.tagline}</p>
              <p className="small"><strong>{priceText(it.offer)}</strong>{!it.available && ' · sedang tidak tersedia'}</p>
              <Link to={`/catalog/${it.slug}`} className="text-link">Lihat detail →</Link>
            </article>
          ))}
        </div>
      </div></section>
    </>
  )
}

export function CatalogDetailPage() {
  const { slug = '' } = useParams()
  const [it, setIt] = useState<CatalogItem | null | undefined>(undefined)
  useEffect(() => { api<CatalogItem>(`/catalog/${encodeURIComponent(slug)}`).then(setIt).catch(() => setIt(null)) }, [slug])
  if (it === undefined) return <p className="muted pad" role="status">Memuat…</p>
  if (it === null) return <NotFoundPage />
  const o = it.offer
  return (
    <>
      <PageHeader eyebrow={TYPE_LABELS[it.type] ?? it.type} title={it.name} intro={it.summary} />
      <section className="section"><div className="container narrow prose" id="catalog-detail">
        <p><strong>{priceText(o)}</strong>{o && o.priceMode === 'quote_required' && ' — lingkup, jumlah deliverable dan harga ditetapkan setelah brief ditinjau.'}</p>
        {o && (
          <>
            <h2 className="h4">Yang bisa dikerjakan</h2>
            <ul>{o.deliverables.map((d) => <li key={d}>{d}</li>)}</ul>
            {o.scope && <><h2 className="h4">Ditetapkan dalam penawaran</h2><ul>{o.scope.map((d) => <li key={d}>{d}</li>)}</ul></>}
            {o.inputs && <><h2 className="h4">Yang kami butuhkan dari Anda</h2><ul>{o.inputs.map((d) => <li key={d}>{d}</li>)}</ul></>}
            <h2 className="h4">Waktu &amp; revisi</h2>
            <p>{o.deliveryAssumption}{o.revisionRounds != null ? ` Revisi termasuk: ${o.revisionRounds} putaran.` : ' Jumlah revisi ditetapkan dalam penawaran.'}</p>
            <h2 className="h4">Pembayaran</h2>
            <p>Untuk proyek berbayar: 50% di muka setelah penawaran disetujui (produksi dimulai setelah pembayaran terverifikasi) dan 50% pelunasan sebelum file final tanpa watermark dikirim.</p>
            <h2 className="h4">Hak penggunaan</h2>
            <p>{o.rightsSummary} <Link to="/ai-licensing">Penggunaan AI &amp; Lisensi Hasil</Link>.</p>
          </>
        )}
        <div className="btn-row">
          {it.available ? <Link to={`/start?offer=${it.slug}`} className="btn btn-primary">Mulai brief</Link> : <p className="muted">Layanan ini sedang tidak tersedia.</p>}
          <Link to="/catalog" className="btn btn-ghost">← Katalog</Link>
        </div>
      </div></section>
    </>
  )
}
