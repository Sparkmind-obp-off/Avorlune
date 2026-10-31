/**
 * Published service catalogue. Intentionally contains NO prices:
 * docs/01 requires quote-based pricing until cost & demand are validated.
 */
export interface ServiceOffer {
  slug: 'ai-image-production' | 'ai-video-production'
  serviceType: 'image' | 'video'
  name: string
  tagline: string
  summary: string
  deliverables: string[]
  scopeDefinedInQuote: string[]
  inputsNeeded: string[]
}

export const SERVICES: ServiceOffer[] = [
  {
    slug: 'ai-image-production',
    serviceType: 'image',
    name: 'AI Image Production',
    tagline: 'Visual produk dan kampanye yang diarahkan, bukan sekadar digenerate.',
    summary:
      'Konsep visual produk, key visual kampanye dan set gambar media sosial yang dikerjakan dengan alat AI, diarahkan secara kreatif dan diperiksa manusia sebelum dikirim.',
    deliverables: [
      'Konsep visual produk & lifestyle',
      'Key visual kampanye',
      'Set gambar media sosial',
      'Variasi kreatif & penyesuaian rasio (bila masuk lingkup)',
    ],
    scopeDefinedInQuote: ['Jumlah gambar', 'Format & rasio aspek', 'Jumlah putaran revisi', 'Estimasi waktu pengerjaan', 'Ketentuan penggunaan'],
    inputsNeeded: ['Tujuan & audiens', 'Foto/aset produk (bila ada)', 'Referensi visual', 'Kanal publikasi'],
  },
  {
    slug: 'ai-video-production',
    serviceType: 'video',
    name: 'AI Video Production',
    tagline: 'Video pendek bernarasi, dirakit dengan presisi editorial.',
    summary:
      'Video promosi pendek, klip visual produk dan konsep kampanye berbasis cerita. Kemampuan teknis bergantung pada alat yang tersedia dan disepakati dalam lingkup.',
    deliverables: [
      'Video promosi format pendek',
      'Klip visual produk/brand',
      'Konsep kampanye berbasis cerita',
      'Edit berbasis motion dari aset yang digenerate (sesuai kemampuan alat)',
    ],
    scopeDefinedInQuote: ['Jumlah video & durasi', 'Rasio aspek & resolusi', 'Audio/musik & lisensinya', 'Jumlah putaran revisi', 'Estimasi waktu pengerjaan'],
    inputsNeeded: ['Tujuan & pesan utama', 'Aset brand/produk', 'Referensi gaya', 'Kanal & durasi target'],
  },
]

/** Portfolio entries must be rights-cleared. None are published yet — the UI shows an honest empty state. */
export interface PortfolioItem {
  id: string
  title: string
  serviceType: 'image' | 'video'
  imageUrl: string
  rightsNote: string
}
export const PORTFOLIO: PortfolioItem[] = []
