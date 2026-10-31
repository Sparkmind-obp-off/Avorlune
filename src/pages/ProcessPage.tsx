import { Link } from 'react-router-dom'
import { PageHeader } from '../components/SiteLayout'

const STEPS = [
  { t: 'Brief', d: 'Anda mengisi brief terstruktur: tujuan, audiens, format, kanal dan referensi. Anda menerima nomor referensi proyek.' },
  { t: 'Arahan & Lingkup', d: 'Kami meninjau kelayakan, hak materi dan tenggat, lalu mengirim lingkup: deliverable, revisi, estimasi waktu, ketentuan penggunaan dan harga.' },
  { t: 'Produksi', d: 'Setelah lingkup disetujui dan pembayaran terkonfirmasi, produksi dimulai dengan alat yang disetujui dan arahan kreatif yang jelas.' },
  { t: 'Review', d: 'Hasil melewati review internal terlebih dahulu, kemudian Anda meninjau preview dan memberi feedback terkonsolidasi.' },
  { t: 'Pengiriman', d: 'Setelah Anda menyetujui, file final dikirim secara privat bersama ketentuan penggunaannya.' },
]

export function ProcessSteps({ compact = false }: { compact?: boolean }) {
  return (
    <ol className={`process ${compact ? 'is-compact' : ''}`}>
      {STEPS.map((s, i) => (
        <li key={s.t} className="process-step">
          <span className="process-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
          <h3 className="h4">{s.t}</h3>
          <p className="muted">{s.d}</p>
        </li>
      ))}
    </ol>
  )
}

export function ProcessPage() {
  return (
    <>
      <PageHeader eyebrow="Proses" title="Cara kami bekerja" intro="Transparan dari brief sampai pengiriman. Lingkup dan batas revisi disepakati sebelum produksi dimulai." />
      <section className="section">
        <div className="container">
          <ProcessSteps />
          <div className="note-box">
            <h2 className="h4">Yang tidak kami janjikan</h2>
            <ul className="tick-list">
              <li>Hasil penjualan, viralitas atau performa iklan tertentu.</li>
              <li>Pengerjaan instan atau sepenuhnya otomatis.</li>
              <li>Penggunaan materi Anda untuk portofolio atau pelatihan AI tanpa izin tertulis terpisah.</li>
            </ul>
          </div>
          <p className="center"><Link to="/start" className="btn btn-primary">Mulai Proyek</Link></p>
        </div>
      </section>
    </>
  )
}
