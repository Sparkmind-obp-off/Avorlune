import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="page-header">
      <div className="container narrow">
        <p className="eyebrow">404</p>
        <h1 className="display">Halaman tidak ditemukan</h1>
        <p className="lead"><Link to="/" className="text-link">Kembali ke beranda</Link></p>
      </div>
    </section>
  )
}
