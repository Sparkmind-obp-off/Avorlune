import { Link, useParams } from 'react-router-dom'
import { SERVICES } from '../../shared/catalogue'
import { PageHeader } from '../components/SiteLayout'
import { NotFoundPage } from './NotFoundPage'

export function ServicesPage() {
  return (
    <>
      <PageHeader eyebrow="Layanan" title="AI Image & AI Video Production" intro="Lingkup setiap proyek — jumlah deliverable, format, revisi, waktu dan ketentuan penggunaan — ditetapkan dalam penawaran." />
      <section className="section">
        <div className="container card-grid two">
          {SERVICES.map((s) => (
            <article key={s.slug} className="service-card">
              <h2 className="h3">{s.name}</h2>
              <p className="muted">{s.summary}</p>
              <Link to={`/services/${s.slug}`} className="text-link">Detail layanan →</Link>
            </article>
          ))}
        </div>
        <div className="container">
          <div className="note-box">
            <h2 className="h4">Paket</h2>
            <p className="muted">
              <strong>Starter</strong> — satu permintaan kreatif dengan lingkup ketat. <strong>Campaign</strong> — set deliverable image/video terkoordinasi.
              Harga berbasis penawaran; kami belum menerbitkan harga tetap sampai biaya dan permintaan tervalidasi.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}

export function ServiceDetailPage() {
  const { slug } = useParams()
  const s = SERVICES.find((x) => x.slug === slug)
  if (!s) return <NotFoundPage />
  return (
    <>
      <PageHeader eyebrow="Layanan" title={s.name} intro={s.summary} />
      <section className="section">
        <div className="container card-grid three">
          <article className="pillar">
            <h2 className="h4">Contoh deliverable</h2>
            <ul className="tick-list">{s.deliverables.map((d) => <li key={d}>{d}</li>)}</ul>
          </article>
          <article className="pillar">
            <h2 className="h4">Ditetapkan dalam penawaran</h2>
            <ul className="tick-list">{s.scopeDefinedInQuote.map((d) => <li key={d}>{d}</li>)}</ul>
          </article>
          <article className="pillar">
            <h2 className="h4">Yang kami butuhkan dari Anda</h2>
            <ul className="tick-list">{s.inputsNeeded.map((d) => <li key={d}>{d}</li>)}</ul>
          </article>
        </div>
        <p className="center"><Link to={`/start?service=${s.serviceType}`} className="btn btn-primary">Mulai proyek {s.serviceType === 'image' ? 'image' : 'video'}</Link></p>
      </section>
    </>
  )
}
