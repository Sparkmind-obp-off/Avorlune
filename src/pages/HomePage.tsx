import { Link } from 'react-router-dom'
import { SERVICES } from '../../shared/catalogue'
import { ProcessSteps } from './ProcessPage'
import { FAQ } from './FaqSection'

export function HomePage() {
  return (
    <>
      <section className="hero" id="hero-section">
        <div className="hero-glow" aria-hidden="true" />
        <div className="container hero-inner">
          <p className="eyebrow">AI Creative Production</p>
          <h1 className="display hero-title">
            Dari brief yang jelas<br />
            menjadi visual yang <em>siap tayang.</em>
          </h1>
          <p className="lead hero-lead">
            AVORLUNE memproduksi image dan video berbantuan AI untuk brand, bisnis dan kreator — dengan arahan kreatif,
            lingkup yang disepakati di depan, dan review manusia sebelum setiap pengiriman.
          </p>
          <div className="hero-actions">
            <Link to="/start" className="btn btn-primary">Mulai Proyek</Link>
            <Link to="/how-it-works" className="btn btn-ghost">Lihat prosesnya</Link>
          </div>
        </div>
      </section>

      <section className="section" id="selected-work">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Karya Terpilih</p>
            <h2 className="h2">Portofolio sedang dikurasi.</h2>
          </div>
          <div className="work-empty">
            <p>
              Kami hanya menampilkan karya yang hak penggunaannya sudah jelas. Contoh proyek pertama sedang disiapkan —
              kami tidak menampilkan karya rekaan atau logo klien yang tidak nyata.
            </p>
            <Link to="/work" className="text-link">Tentang kebijakan portofolio →</Link>
          </div>
        </div>
      </section>

      <section className="section section-alt" id="services-section">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Layanan</p>
            <h2 className="h2">Dua disiplin, satu standar produksi.</h2>
          </div>
          <div className="card-grid two">
            {SERVICES.map((s) => (
              <article key={s.slug} className="service-card">
                <p className="eyebrow">{s.serviceType === 'image' ? '01 — Image' : '02 — Video'}</p>
                <h3 className="h3">{s.name}</h3>
                <p className="muted">{s.tagline}</p>
                <ul className="tick-list">
                  {s.deliverables.slice(0, 3).map((d) => <li key={d}>{d}</li>)}
                </ul>
                <Link to={`/services/${s.slug}`} className="text-link">Detail layanan →</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="process-section">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Proses</p>
            <h2 className="h2">Brief → Arahan → Produksi → Review → Pengiriman</h2>
          </div>
          <ProcessSteps compact />
        </div>
      </section>

      <section className="section section-alt" id="why-section">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Mengapa AVORLUNE</p>
            <h2 className="h2">Kecepatan AI, keputusan tetap di tangan manusia.</h2>
          </div>
          <div className="card-grid three">
            <article className="pillar">
              <h3 className="h4">Arahan kreatif</h3>
              <p className="muted">Setiap proyek dimulai dari konsep dan spesifikasi yang disepakati — bukan prompt acak.</p>
            </article>
            <article className="pillar">
              <h3 className="h4">Eksplorasi berbantuan AI</h3>
              <p className="muted">Alat AI dipakai untuk mempercepat eksplorasi dan produksi, sesuai kemampuan dan ketentuan lisensi alatnya.</p>
            </article>
            <article className="pillar">
              <h3 className="h4">Quality control manusia</h3>
              <p className="muted">Setiap hasil diperiksa sebelum Anda lihat: akurasi produk, konsistensi brand, cacat visual dan spesifikasi.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section" id="faq-section">
        <div className="container narrow">
          <div className="section-head">
            <p className="eyebrow">FAQ</p>
            <h2 className="h2">Pertanyaan yang sering muncul</h2>
          </div>
          <FAQ />
        </div>
      </section>

      <section className="cta-band" id="final-cta">
        <div className="container cta-inner">
          <h2 className="display h2">Punya ide visual yang perlu diwujudkan?</h2>
          <p className="lead">Ceritakan kebutuhan Anda. Kami tinjau, lalu kirim lingkup dan penawaran — tanpa kewajiban.</p>
          <Link to="/start" className="btn btn-primary">Mulai Proyek</Link>
        </div>
      </section>
    </>
  )
}
