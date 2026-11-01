import { PageHeader } from '../components/SiteLayout'

const Draft = () => (
  <p className="draft-banner" role="note">
    <strong>Draf kerja.</strong> Dokumen ini belum ditinjau penasihat hukum dan akan diperbarui sebelum menerima proyek berbayar secara publik.
  </p>
)

export function PrivacyPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Kebijakan Privasi" />
      <section className="section">
        <div className="container narrow prose">
          <Draft />
          <h2 className="h4">Data yang kami kumpulkan</h2>
          <p>Nama, kanal kontak (email atau WhatsApp), isi brief proyek, tautan referensi dan rentang anggaran yang Anda kirimkan. Kami tidak menyimpan data kartu pembayaran.</p>
          <h2 className="h4">Tujuan</h2>
          <p>Hanya untuk meninjau, menyusun lingkup, memproduksi dan mengirimkan proyek Anda, serta menghubungi Anda terkait proyek tersebut.</p>
          <h2 className="h4">Kerahasiaan</h2>
          <p>Brief, unggahan, preview dan file final bersifat rahasia secara default. Kami tidak memakai karya Anda untuk portofolio atau pelatihan AI tanpa izin tertulis terpisah. Materi rahasia tidak dikirim ke penyedia AI kecuali ketentuan proyek dan kebijakan data penyedia mengizinkannya.</p>
          <h2 className="h4">Keamanan</h2>
          <p>Akses ke data proyek dibatasi untuk staf berwenang. Tautan proyek klien bersifat privat, memiliki masa berlaku dan dapat dicabut. Alamat IP hanya disimpan dalam bentuk hash untuk pembatasan laju (anti-spam).</p>
          <h2 className="h4">Pihak ketiga</h2>
          <p>Situs dan database dijalankan di infrastruktur Cloudflare. Alat AI pihak ketiga hanya digunakan sesuai kebutuhan produksi; materi rahasia tidak dikirim ke alat tersebut tanpa dasar yang sesuai dengan ketentuan proyek dan kebijakan data penyedia.</p>
          <h2 className="h4">Pemrosesan manual</h2>
          <p>Saat ini konfirmasi, pembaruan status dan konfirmasi pembayaran dilakukan secara manual oleh tim. Belum ada notifikasi otomatis maupun gateway pembayaran.</p>
          <h2 className="h4">Retensi &amp; hak Anda</h2>
          <p>Kebijakan retensi final akan diterbitkan sebelum peluncuran publik. Anda dapat meminta akses, koreksi atau penghapusan data melalui halaman Kontak dengan menyertakan nomor referensi proyek.</p>
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
          <h2 className="h4">Lingkup &amp; penawaran</h2>
          <p>Setiap proyek dikerjakan berdasarkan penawaran tertulis yang memuat deliverable, format, jumlah revisi, estimasi waktu, ketentuan penggunaan dan harga. Mengirim brief tidak mewajibkan Anda membeli, dan tidak mewajibkan kami menerima proyek.</p>
          <h2 className="h4">Pembayaran</h2>
          <p>Produksi dimulai setelah pembayaran terkonfirmasi atau pengecualian yang disepakati tertulis.</p>
          <h2 className="h4">Revisi</h2>
          <p>Revisi di luar jumlah yang disepakati atau perubahan arah kreatif dapat dikenai biaya tambahan setelah dikonfirmasi.</p>
          <h2 className="h4">Materi dari klien</h2>
          <p>Anda menjamin memiliki hak atas logo, foto, musik, footage dan kemiripan orang yang Anda kirimkan. Izin eksplisit diperlukan untuk orang yang dapat dikenali atau penggunaan suara.</p>
          <h2 className="h4">Hak penggunaan hasil</h2>
          <p>Ketentuan penggunaan dicantumkan bersama pengiriman dan bergantung pada ketentuan alat produksi yang digunakan. Kami tidak menjanjikan kepemilikan eksklusif bila ketentuan alat tidak memberikannya.</p>
          <h2 className="h4">Pengungkapan penggunaan AI</h2>
          <p>Hasil diproduksi dengan bantuan alat AI generatif dan diarahkan, diseleksi, disunting serta diperiksa oleh manusia. Perlindungan hak cipta atas keluaran yang sebagian besar dihasilkan AI dapat terbatas atau belum pasti menurut hukum yang berlaku; kami tidak menjamin hasil dapat didaftarkan atau dilindungi hak cipta.</p>
          <h2 className="h4">Pengiriman &amp; persetujuan</h2>
          <p>File final dikirim secara privat. Selama fitur pengiriman di portal belum aktif, file dikirim melalui kanal privat yang disepakati dan persetujuan akhir dikonfirmasi secara tertulis. Proyek dianggap selesai setelah persetujuan tercatat.</p>
          <h2 className="h4">Portofolio</h2>
          <p>Kami tidak menampilkan karya Anda di portofolio atau materi promosi tanpa izin tertulis terpisah dari Anda.</p>
          <h2 className="h4">Pembatalan, refund &amp; keluhan</h2>
          <p>Ketentuan pembatalan dan refund dicantumkan di penawaran masing-masing proyek. Keluhan dapat disampaikan melalui halaman Kontak dengan menyertakan nomor referensi proyek; kami akan menanggapi melalui kanal kontak yang Anda pilih.</p>
          <h2 className="h4">Tanpa jaminan hasil bisnis</h2>
          <p>Kami tidak menjamin penjualan, viralitas atau performa iklan.</p>
        </div>
      </section>
    </>
  )
}
