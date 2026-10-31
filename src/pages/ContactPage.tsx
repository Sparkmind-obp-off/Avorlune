import { Link } from 'react-router-dom'
import { PageHeader } from '../components/SiteLayout'

export function ContactPage() {
  return (
    <>
      <PageHeader eyebrow="Kontak" title="Hubungi kami" intro="Cara tercepat dan paling terstruktur adalah melalui formulir proyek." />
      <section className="section">
        <div className="container narrow prose">
          <p>Kirim brief melalui <Link to="/start">formulir Mulai Proyek</Link>. Anda akan menerima nomor referensi, dan tim kami menghubungi Anda melalui kanal kontak yang Anda pilih (email atau WhatsApp).</p>
          <p>Untuk permintaan akses, koreksi atau penghapusan data, sertakan nomor referensi proyek Anda melalui formulir yang sama dan pilih "Lainnya" di deskripsi.</p>
          <p className="small muted">Kanal kontak publik terpisah (email resmi/sosial media) akan dicantumkan setelah domain dan akun terverifikasi.</p>
        </div>
      </section>
    </>
  )
}
