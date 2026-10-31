const ITEMS = [
  {
    q: 'Apa yang perlu saya siapkan?',
    a: 'Tujuan konten, audiens, kanal publikasi, format yang dibutuhkan dan referensi visual. Aset produk atau brand (foto, logo) sangat membantu. Anda wajib memiliki hak atas materi yang Anda kirimkan.',
  },
  {
    q: 'Berapa biayanya?',
    a: 'Saat ini setiap proyek dihitung berdasarkan lingkup (quote-based): jumlah deliverable, kompleksitas, revisi dan lisensi. Kami belum menerbitkan harga tetap.',
  },
  {
    q: 'Berapa kali revisi?',
    a: 'Jumlah putaran revisi dicantumkan di setiap penawaran. Perubahan di luar lingkup yang disepakati akan dikonfirmasi dan dapat dikenai biaya tambahan.',
  },
  {
    q: 'Bagaimana dengan hak penggunaan hasilnya?',
    a: 'Ketentuan penggunaan dicantumkan bersama penawaran dan pengiriman. Hak yang dapat kami berikan bergantung pada ketentuan alat yang dipakai — kami tidak menjanjikan kepemilikan eksklusif bila ketentuan alat tidak memungkinkannya.',
  },
  {
    q: 'Berapa lama pengerjaannya?',
    a: 'Estimasi waktu ditentukan setelah brief ditinjau dan dicantumkan di penawaran. Kami tidak menjanjikan pengerjaan instan.',
  },
  {
    q: 'Apakah hasilnya dibuat sepenuhnya oleh AI?',
    a: 'Tidak sepenuhnya. Alat AI membantu produksi, tetapi arahan kreatif, seleksi, penyuntingan dan quality control dilakukan manusia.',
  },
]

export function FAQ() {
  return (
    <div className="faq">
      {ITEMS.map((i) => (
        <details key={i.q} className="faq-item">
          <summary>{i.q}</summary>
          <p>{i.a}</p>
        </details>
      ))}
    </div>
  )
}
