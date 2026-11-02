import { Link } from 'react-router-dom'
import { PageHeader } from '../components/SiteLayout'

const Draft = () => (
  <p className="draft-banner" role="note">
    <strong>Draf kerja.</strong> Dokumen ini belum ditinjau penasihat hukum dan dapat berubah sebelum peluncuran publik. Bila ada perbedaan, ketentuan
    dalam penawaran tertulis proyek Anda yang berlaku.
  </p>
)

const Ext = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>
)

/** Source list shown on legal pages — official documents only, with the date they were read. */
const SOURCES_CHECKED = '2 November 2026'

export function PrivacyPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Kebijakan Privasi" />
      <section className="section">
        <div className="container narrow prose">
          <Draft />
          <h2 className="h4">Data yang kami kumpulkan</h2>
          <p>Nama, kanal kontak (email atau WhatsApp), isi brief proyek, tautan referensi, rentang anggaran, pesan dukungan, dan file yang dipertukarkan dalam proyek. Kami tidak menerima maupun menyimpan data kartu atau rekening pembayaran; pembayaran online diproses oleh penyedia pembayaran.</p>
          <h2 className="h4">Tujuan</h2>
          <p>Hanya untuk meninjau, menyusun lingkup, memproduksi dan mengirimkan proyek Anda, memproses pembayaran dan refund, serta menghubungi Anda terkait proyek tersebut.</p>
          <h2 className="h4">Kerahasiaan</h2>
          <p>Brief, unggahan, preview dan file final bersifat rahasia secara default. Kami tidak memakai karya Anda untuk portofolio tanpa izin tertulis terpisah.</p>
          <h2 className="h4">Alat AI pihak ketiga</h2>
          <p>Produksi menggunakan alat AI generatif pihak ketiga (saat ini Genspark.ai). Bagian brief atau materi yang diperlukan untuk produksi dapat diproses oleh alat tersebut sesuai <Ext href="https://www.genspark.ai/privacy">kebijakan privasi penyedia</Ext>. Jangan kirim data yang tidak boleh diproses pihak ketiga; beri tahu kami bila ada materi yang wajib dikecualikan.</p>
          <h2 className="h4">Pihak ketiga lainnya</h2>
          <p>Situs, database dan penyimpanan file berjalan di infrastruktur Cloudflare. Pembayaran online (bila diaktifkan) diproses oleh Duitku; kami hanya menerima status, nominal dan nomor referensi transaksi.</p>
          <h2 className="h4">Keamanan</h2>
          <p>Akses ke data proyek dibatasi untuk staf berwenang. Tautan proyek klien bersifat privat, memiliki masa berlaku dan dapat dicabut. Alamat IP hanya disimpan dalam bentuk hash untuk pembatasan laju (anti-spam).</p>
          <h2 className="h4">Notifikasi</h2>
          <p>Pemberitahuan status proyek saat ini dikirim manual oleh tim melalui kanal kontak Anda. Email otomatis belum aktif.</p>
          <h2 className="h4">Retensi &amp; hak Anda</h2>
          <p>Kebijakan retensi final akan diterbitkan sebelum peluncuran publik. Anda dapat meminta akses, koreksi atau penghapusan data melalui halaman Kontak atau menu Bantuan di portal proyek dengan menyertakan nomor referensi proyek.</p>
        </div>
      </section>
    </>
  )
}

export function TermsPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Ketentuan Layanan" />
      <section className="section">
        <div className="container narrow prose">
          <Draft />
          <h2 className="h4">Apa yang kami jual</h2>
          <p>AVORLUNE menjual <strong>jasa produksi kreatif</strong>: penyusunan konsep, pengarahan, seleksi, penyuntingan dan pemeriksaan kualitas oleh manusia, dengan bantuan alat AI generatif. Kami <strong>tidak</strong> menjual, menyewakan atau mengalihkan akun, kredit, langganan atau akses ke alat AI mana pun.</p>
          <h2 className="h4">Lingkup &amp; penawaran</h2>
          <p>Setiap proyek dikerjakan berdasarkan penawaran tertulis yang memuat deliverable, format, jumlah revisi, estimasi waktu, ketentuan penggunaan dan harga. Mengirim brief tidak mewajibkan Anda membeli, dan tidak mewajibkan kami menerima proyek. Lihat <Link to="/pricing">Harga</Link>.</p>
          <h2 className="h4">Pembayaran</h2>
          <p>Produksi dimulai setelah pembayaran terkonfirmasi atau pengecualian yang disepakati tertulis. Status lunas pembayaran online hanya ditetapkan setelah konfirmasi server-ke-server dari penyedia pembayaran, bukan dari tampilan browser.</p>
          <h2 className="h4">Revisi</h2>
          <p>Revisi di luar jumlah yang disepakati atau perubahan arah kreatif dapat dikenai biaya tambahan setelah dikonfirmasi.</p>
          <h2 className="h4">Materi dari klien</h2>
          <p>Anda menjamin memiliki hak atas logo, foto, musik, footage dan kemiripan orang yang Anda kirimkan. Izin eksplisit diperlukan untuk orang yang dapat dikenali atau penggunaan suara. Hak atas materi Anda tetap milik Anda.</p>
          <h2 className="h4">Penggunaan AI &amp; hak atas hasil</h2>
          <p>Ringkasnya: hasil boleh Anda gunakan secara komersial sesuai lisensi penggunaan yang kami cantumkan saat pengiriman, tetapi kami <strong>tidak menjanjikan hak cipta eksklusif</strong> atas bagian yang dihasilkan AI. Rincian, dasar hukum dan sumber resminya ada di <Link to="/ai-licensing">Penggunaan AI &amp; Lisensi Hasil</Link>.</p>
          <h2 className="h4">Pengungkapan sumber</h2>
          <p>Ketentuan alat AI yang kami gunakan mewajibkan konten yang dipublikasikan ulang tidak menyesatkan soal asal-usul dan cara pembuatannya. Karena itu setiap pengiriman menyertakan keterangan bahwa hasil dibuat dengan bantuan AI. Anda setuju tidak menyatakan hasil sebagai karya yang dibuat sepenuhnya tanpa AI.</p>
          <h2 className="h4">Pengiriman &amp; persetujuan</h2>
          <p>File final dikirim secara privat setelah pemeriksaan kualitas dan pemeriksaan lisensi. Proyek dianggap selesai setelah persetujuan tercatat.</p>
          <h2 className="h4">Portofolio</h2>
          <p>Kami tidak menampilkan karya Anda di portofolio atau materi promosi tanpa izin tertulis terpisah dari Anda.</p>
          <h2 className="h4">Pembatalan, refund &amp; keluhan</h2>
          <p>Lihat <Link to="/refund-policy">Kebijakan Pembatalan &amp; Refund</Link>. Keluhan dapat disampaikan melalui menu Bantuan di portal proyek atau halaman Kontak.</p>
          <h2 className="h4">Tanpa jaminan hasil bisnis</h2>
          <p>Kami tidak menjamin penjualan, viralitas atau performa iklan.</p>
        </div>
      </section>
    </>
  )
}

export function AiLicensingPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Penggunaan AI & Lisensi Hasil" intro="Apa yang boleh dan tidak boleh dilakukan dengan hasil produksi berbasis AI — berdasarkan dokumen resmi, bukan asumsi." />
      <section className="section">
        <div className="container narrow prose">
          <Draft />

          <h2 className="h4">1. Apakah hasil AI boleh dikomersialkan?</h2>
          <p><strong>Ya, dengan syarat.</strong> Alat produksi kami saat ini adalah Genspark.ai. Ketentuannya menyatakan layanan boleh digunakan untuk tujuan internal, pribadi atau komersial, <em>termasuk atas nama atau untuk kepentingan pihak ketiga</em>, sesuai paket langganan yang berlaku. Pusat bantuan Genspark menjelaskan bahwa hak penggunaan komersial atas konten AI, termasuk <em>pekerjaan klien, deliverable, situs web dan iklan</em>, termasuk dalam paket berbayar (Plus, Pro, Team, Enterprise) untuk konten yang dibuat <strong>selama langganan aktif</strong>, dan dijamin hingga 30 Juni 2027.</p>
          <p>Karena itu AVORLUNE hanya memakai keluaran yang dibuat di akun berbayar yang aktif saat pembuatan, dan mencatat bukti langganan untuk setiap file final sebelum dikirim.</p>

          <h2 className="h4">2. Yang dilarang</h2>
          <ul>
            <li><strong>Menjual atau menyewakan kredit, akun atau akses</strong> ke alat AI. Ketentuan Genspark melarang membagikan, mengalihkan atau menjual akun, dan melarang menjual kembali akses atau memakai Genspark untuk menjalankan layanan pihak ketiga. AVORLUNE tidak menjual kredit — kami menjual jasa produksi.</li>
            <li><strong>Ekstraksi otomatis/scraping</strong> dari Genspark atau memakainya sebagai sumber data untuk layanan lain. Produksi kami dikerjakan manusia.</li>
            <li><strong>Menyesatkan asal-usul konten.</strong> Konten yang dipublikasikan ulang harus mengakui sumbernya dan tidak boleh disebut bukan hasil AI.</li>
            <li>Membuat konten yang melanggar hukum, eksplisit, kebencian, penipuan, atau melanggar hak kekayaan intelektual pihak lain.</li>
          </ul>

          <h2 className="h4">3. Hak cipta atas hasil AI</h2>
          <p><strong>Di Indonesia</strong>, Direktorat Jenderal Kekayaan Intelektual (DJKI) menyatakan bahwa menurut UU No. 28 Tahun 2014 pencipta adalah manusia, sehingga karya yang dihasilkan sepenuhnya oleh AI secara otonom tidak memperoleh pelindungan hak cipta dan tidak akan dicatatkan; karya yang menggunakan AI sebagai alat bantu tetap dapat dilindungi sepanjang terdapat kontribusi intelektual manusia yang signifikan. Pengaturan AI dalam RUU Hak Cipta masih disusun.</p>
          <p><strong>Di Amerika Serikat</strong>, U.S. Copyright Office menyimpulkan keluaran AI generatif hanya dapat dilindungi bila manusia menentukan unsur ekspresif yang cukup — misalnya karya manusia yang terlihat dalam hasil, atau penataan/modifikasi kreatif oleh manusia — dan <em>tidak</em> dari pemberian prompt semata.</p>
          <p>Artinya:</p>
          <ul>
            <li>Bagian yang murni dihasilkan AI kemungkinan <strong>tidak dilindungi hak cipta</strong> — pihak lain mungkin dapat memakai elemen serupa, dan kami tidak dapat menjamin hasil bisa didaftarkan.</li>
            <li>Kontribusi manusia (konsep, seleksi, komposisi, penyuntingan, teks, materi milik Anda) dapat dilindungi sesuai hukum yang berlaku.</li>
            <li>Kami <strong>tidak menjanjikan kepemilikan atau hak cipta eksklusif</strong> atas bagian hasil AI.</li>
          </ul>

          <h2 className="h4">4. Lisensi yang Anda terima</h2>
          <p>Setelah pelunasan, Anda menerima izin menggunakan file final untuk keperluan yang disebut dalam penawaran (misalnya media sosial, situs web, iklan). Sejauh hak tersebut ada pada kami, kami mengalihkan atau melisensikan hak atas kontribusi kreatif kami sesuai penawaran. Batasan tambahan (mis. materi stok, musik, atau ketentuan alat pihak ketiga) dicantumkan bersama pengiriman.</p>

          <h2 className="h4">5. Pemeriksaan sebelum pengiriman</h2>
          <p>Sistem kami tidak mengizinkan status <em>Terkirim</em> sebelum setiap file final memiliki catatan provenans (sumber, alat, referensi pembuatan), bukti lisensi, status penggunaan komersial “diizinkan”, dan persetujuan QA oleh manusia. Materi yang tercatat tidak boleh dipakai komersial memblokir pengiriman.</p>

          <h2 className="h4">6. Risiko yang tetap ada</h2>
          <p>Penyedia AI tidak memberikan hak yang dimiliki pihak ketiga (mis. penyedia model atau perangkat lunak sumber terbuka) dan menyerahkan risiko klaim pelanggaran kepada pengguna. Hasil AI dapat secara tidak sengaja menyerupai karya, merek atau orang yang ada. Kami memeriksa hasil secara manual, tetapi tidak dapat menjamin bebas dari kemiripan tersebut. Hindari meminta gaya, karakter, merek atau wajah milik pihak lain tanpa izin.</p>

          <h2 className="h4">7. Ketentuan dapat berubah</h2>
          <p>Genspark menyatakan dapat memperbarui ketentuannya, termasuk membatasi penggunaan komersial pada paket berbayar. Kami memeriksa ulang ketentuan penyedia secara berkala dan memperbarui halaman ini.</p>

          <h2 className="h4">Sumber resmi (diperiksa {SOURCES_CHECKED})</h2>
          <ul className="small">
            <li><Ext href="https://www.genspark.ai/terms">Genspark — Terms of Service</Ext> (terakhir diperbarui 2 April 2026): bagian Acceptable Use, Intellectual Property Rights.</li>
            <li><Ext href="https://www.genspark.ai/helpcenter/membership-plans">Genspark Help Center — Membership Plans</Ext>: bagian Commercial use, Fair Use Limit.</li>
            <li><Ext href="https://www.dgip.go.id/artikel/detail-artikel-berita/pemerintah-ai-bukan-pengganti-manusia-dalam-penciptaan-karya?kategori=liputan-humas">DJKI Kementerian Hukum — “AI Bukan Pengganti Manusia dalam Penciptaan Karya”</Ext> (26 Mei 2026).</li>
            <li><Ext href="https://peraturan.bpk.go.id/Details/38690/uu-no-28-tahun-2014">UU No. 28 Tahun 2014 tentang Hak Cipta</Ext>.</li>
            <li><Ext href="https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf">U.S. Copyright Office — Copyright and Artificial Intelligence, Part 2: Copyrightability</Ext> (Januari 2025).</li>
          </ul>
          <p className="small muted">Halaman ini adalah ringkasan informasi, bukan nasihat hukum.</p>
        </div>
      </section>
    </>
  )
}

export function PricingPage() {
  return (
    <>
      <PageHeader eyebrow="Harga" title="Harga berdasarkan penawaran" intro="Kami belum menerbitkan daftar harga tetap. Setiap proyek mendapat penawaran tertulis sebelum ada kewajiban membayar." />
      <section className="section">
        <div className="container narrow prose">
          <h2 className="h4">Bagaimana harga ditentukan</h2>
          <ul>
            <li>Jenis layanan: AI image, AI video, atau gabungan.</li>
            <li>Jumlah deliverable, format dan rasio aspek.</li>
            <li>Durasi dan kompleksitas (khusus video).</li>
            <li>Jumlah putaran revisi yang termasuk.</li>
            <li>Tenggat waktu.</li>
            <li>Kebutuhan lisensi tambahan (mis. musik atau materi stok) — dicantumkan terpisah bila ada.</li>
          </ul>
          <h2 className="h4">Yang tercantum dalam penawaran</h2>
          <p>Total harga dalam Rupiah, daftar deliverable, jumlah revisi, estimasi selesai, ketentuan penggunaan hasil, dan ketentuan pembatalan. Nominal pembayaran online selalu diambil dari penawaran yang Anda setujui — tidak dapat diubah dari browser.</p>
          <h2 className="h4">Promo &amp; cashback</h2>
          <p>Saat ini tidak ada program promo atau cashback. Bila nanti tersedia, syaratnya akan diumumkan tertulis dan dicantumkan dalam penawaran.</p>
          <p><Link to="/start" className="btn btn-primary">Minta penawaran</Link></p>
        </div>
      </section>
    </>
  )
}

export function RefundPolicyPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Kebijakan Pembatalan & Refund" />
      <section className="section">
        <div className="container narrow prose">
          <Draft />
          <h2 className="h4">Prinsip</h2>
          <p>Ketentuan pembatalan dan refund untuk setiap proyek dicantumkan dalam penawaran tertulis. Halaman ini menjelaskan proses umum yang benar-benar kami jalankan saat ini.</p>
          <h2 className="h4">Sebelum pembayaran</h2>
          <p>Anda dapat menolak penawaran atau membatalkan permintaan tanpa biaya.</p>
          <h2 className="h4">Setelah pembayaran</h2>
          <ul>
            <li>Ajukan pembatalan atau refund melalui menu <strong>Bantuan</strong> di portal proyek (kategori “Pembatalan / refund”) atau halaman Kontak, dengan nomor referensi proyek.</li>
            <li>Kelayakan dan besar refund mengikuti ketentuan penawaran dan sejauh mana pekerjaan sudah dilakukan. Biaya pihak ketiga yang tidak dapat dikembalikan (mis. biaya transaksi pembayaran atau lisensi yang sudah dibeli untuk proyek Anda) dapat dikurangkan bila tercantum di penawaran.</li>
            <li>Setelah file final disetujui dan dikirim, refund tidak tersedia kecuali diwajibkan hukum atau disepakati tertulis.</li>
          </ul>
          <h2 className="h4">Cara refund diproses</h2>
          <p>Refund saat ini diproses <strong>manual</strong> oleh tim — melalui portal penyedia pembayaran atau transfer bank — lalu dicatat di sistem beserta nomor referensi bukti. Status refund dapat Anda lihat di portal proyek. Waktu dana diterima bergantung pada bank atau kanal pembayaran.</p>
          <h2 className="h4">Bila permintaan ditolak</h2>
          <p>Kami akan menjelaskan alasannya melalui kanal kontak Anda. Anda tetap dapat menyampaikan keluhan atau menempuh jalur penyelesaian sengketa konsumen sesuai hukum yang berlaku.</p>
        </div>
      </section>
    </>
  )
}
