import { PageHeader } from '../components/SiteLayout'

export function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="Tentang" title="Studio produksi kreatif berbantuan AI" intro="AVORLUNE membantu brand dan kreator mengubah ide yang jelas menjadi konten visual yang rapi melalui proses produksi terpandu." />
      <section className="section">
        <div className="container narrow prose">
          <h2 className="h3">Apa kami</h2>
          <p>Layanan produksi kreatif yang memakai alat AI dan arahan manusia untuk menghasilkan visual siap kampanye: image produk, key visual, set media sosial dan video format pendek.</p>
          <h2 className="h3">Apa yang bukan kami</h2>
          <ul className="tick-list">
            <li>Bukan perusahaan model AI atau chatbot generik.</li>
            <li>Bukan layanan konten massal otomatis atau auto-posting.</li>
            <li>Bukan janji bahwa setiap output sepenuhnya otomatis atau langsung sempurna.</li>
          </ul>
          <h2 className="h3">Komitmen kami</h2>
          <ul className="tick-list">
            <li>Brief dan lingkup yang jelas sebelum produksi.</li>
            <li>Review manusia sebelum pengiriman.</li>
            <li>Status dan batas revisi yang transparan.</li>
            <li>Keterbukaan bahwa produksi dibantu AI.</li>
          </ul>
          <p className="small muted">AVORLUNE adalah nama kerja. Pemeriksaan domain, akun sosial dan merek dagang belum selesai; tidak ada klaim izin hukum atas nama ini.</p>
        </div>
      </section>
    </>
  )
}
