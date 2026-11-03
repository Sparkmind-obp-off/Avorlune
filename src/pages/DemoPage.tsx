import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/SiteLayout'

/**
 * Public interactive demo (docs/71). 100% synthetic and client-side: no API calls, no database, no storage,
 * no payment, no provider calls. Every value below is fictional and labelled as such.
 */
const STEPS = [
  { key: 'brief', label: 'Brief dikirim', text: 'Klien fiktif “Kopi Senja” mengirim brief: 5 visual produk untuk peluncuran kemasan baru, Instagram feed 4:5.' },
  { key: 'quote', label: 'Penawaran', text: 'Tim menyusun lingkup: 5 gambar 4:5, 1 putaran revisi, estimasi 5 hari kerja. Nominal pada demo hanyalah ilustrasi.' },
  { key: 'deposit', label: 'Pembayaran 50%', text: 'Klien membayar 50% di muka. Pada sistem sungguhan, status lunas hanya ditetapkan setelah verifikasi server ke gateway — di demo ini disimulasikan.' },
  { key: 'production', label: 'Produksi', text: 'Produksi berbantuan AI oleh manusia. Setiap file dicatat provenans dan lisensinya.' },
  { key: 'review', label: 'Review klien', text: 'Preview ber-watermark dikirim. Klien meminta satu revisi warna latar.' },
  { key: 'balance', label: 'Pelunasan 50%', text: 'Setelah revisi disetujui, klien melunasi sisa 50%.' },
  { key: 'delivered', label: 'Terkirim', text: 'File final tanpa watermark dirilis setelah QA manusia dan pemeriksaan lisensi.' },
]

export function DemoPage() {
  const [i, setI] = useState(0)
  return (
    <>
      <PageHeader eyebrow="Demo" title="Lihat alur proyek AVORLUNE" intro="Simulasi interaktif dengan data fiktif. Tidak ada akun, pembayaran atau file sungguhan." />
      <section className="section"><div className="container narrow" id="demo">
        <p className="draft-banner" role="note"><strong>DEMO — data fiktif.</strong> Nama klien, brief dan nominal hanyalah ilustrasi, bukan harga atau portofolio AVORLUNE.</p>
        <ol className="timeline demo-timeline">
          {STEPS.map((s, idx) => (
            <li key={s.key} className={idx <= i ? 'is-done' : ''} aria-current={idx === i ? 'step' : undefined}>
              <span className="timeline-dot" aria-hidden="true" /><strong>{s.label}</strong>
              {idx === i && <p className="small">{s.text}</p>}
            </li>
          ))}
        </ol>
        <div className="btn-row">
          <button className="btn btn-ghost" disabled={i === 0} onClick={() => setI(i - 1)}>← Sebelumnya</button>
          {i < STEPS.length - 1
            ? <button className="btn btn-primary" onClick={() => setI(i + 1)}>Langkah berikutnya →</button>
            : <Link to="/catalog" className="btn btn-primary">Lihat layanan sungguhan</Link>}
        </div>
      </div></section>
    </>
  )
}
