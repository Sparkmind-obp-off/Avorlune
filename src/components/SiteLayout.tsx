import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { UserButton } from '@clerk/react'
import { useCustomerAuth } from '../lib/auth'

const NAV = [
  { to: '/catalog', label: 'Katalog' },
  { to: '/work', label: 'Karya' },
  { to: '/how-it-works', label: 'Proses' },
  { to: '/demo', label: 'Demo' },
  { to: '/about', label: 'Tentang' },
  { to: '/contact', label: 'Kontak' },
]

export function Logo() {
  return (
    <span className="logo" aria-label="AVORLUNE">
      <svg viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
        <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="20" cy="13" r="9" fill="var(--bg)" />
      </svg>
      AVORLUNE
    </span>
  )
}

/** Customer account controls only (Clerk). No admin entry point is ever rendered on the customer site. */
function AccountNav() {
  const auth = useCustomerAuth()
  if (!auth.enabled || !auth.loaded) return null
  if (!auth.signedIn) return <NavLink to="/sign-in">Masuk</NavLink>
  return (
    <span className="account-nav">
      <NavLink to="/account">Akun</NavLink>
      <UserButton />
    </span>
  )
}

export function SiteLayout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])

  return (
    <div className="site">
      <a className="skip-link" href="#main">Lewati ke konten</a>
      <header className="site-header" id="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand-link"><Logo /></Link>
          <button className="nav-toggle" aria-expanded={open} aria-controls="primary-nav" onClick={() => setOpen((v) => !v)}>
            <span className="sr-only">Menu</span>
            <span aria-hidden="true">{open ? '✕' : '☰'}</span>
          </button>
          <nav id="primary-nav" className={`primary-nav ${open ? 'is-open' : ''}`} aria-label="Navigasi utama">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>{n.label}</NavLink>
            ))}
            <AccountNav />
            <Link to="/start" className="btn btn-primary btn-sm">Mulai Proyek</Link>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer" id="site-footer">
        <div className="container footer-grid">
          <div>
            <Logo />
            <p className="muted small">AI Creative Production. Produksi image &amp; video berbantuan AI dengan arahan kreatif dan quality control manusia.</p>
          </div>
          <nav aria-label="Navigasi footer" className="footer-links">
            <Link to="/catalog">Katalog</Link>
            <Link to="/services">Layanan</Link>
            <Link to="/demo">Demo</Link>
            <Link to="/work">Karya</Link>
            <Link to="/how-it-works">Proses</Link>
            <Link to="/start">Mulai Proyek</Link>
          </nav>
          <nav aria-label="Legal" className="footer-links">
            <Link to="/privacy">Privasi</Link>
            <Link to="/terms">Ketentuan</Link>
            <Link to="/ai-licensing">AI &amp; Lisensi</Link>
            <Link to="/refund-policy">Refund</Link>
            <Link to="/pricing">Harga</Link>
            <Link to="/contact">Kontak</Link>
          </nav>
        </div>
        <div className="container footer-note small muted">
          © {new Date().getFullYear()} AVORLUNE — nama kerja (working name); pemeriksaan merek dagang belum selesai.
        </div>
      </footer>
    </div>
  )
}

export function PageHeader({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <section className="page-header">
      <div className="container narrow">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display">{title}</h1>
        {intro && <p className="lead">{intro}</p>}
      </div>
    </section>
  )
}
