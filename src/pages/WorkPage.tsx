import { Link } from 'react-router-dom'
import { PORTFOLIO } from '../../shared/catalogue'
import { PageHeader } from '../components/SiteLayout'

export function WorkPage() {
  return (
    <>
      <PageHeader eyebrow="Karya" title="Portofolio" intro="Hanya karya dengan hak penggunaan yang jelas yang akan tampil di sini." />
      <section className="section">
        <div className="container">
          {PORTFOLIO.length === 0 ? (
            <div className="work-empty">
              <h2 className="h4">Belum ada karya yang dipublikasikan</h2>
              <p>
                Contoh proyek sedang diproduksi. Kami sengaja tidak menampilkan karya rekaan, testimoni fiktif atau logo klien yang
                tidak nyata. Karya klien hanya akan ditampilkan dengan izin tertulis terpisah.
              </p>
              <Link to="/start" className="btn btn-primary">Diskusikan proyek Anda</Link>
            </div>
          ) : (
            <div className="card-grid three">
              {PORTFOLIO.map((p) => (
                <figure key={p.id} className="work-card">
                  <img src={p.imageUrl} alt={p.title} loading="lazy" />
                  <figcaption>{p.title}<span className="small muted">{p.rightsNote}</span></figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
