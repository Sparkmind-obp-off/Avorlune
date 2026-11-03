import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Logo } from '../../components/SiteLayout'
import { Alert, Field } from '../../components/Field'
import { api, ApiFailure, setCsrf, setReauthHandler } from '../../lib/api'
import { AdminInbox } from './AdminInbox'
import { AdminProjectDetail } from './AdminProjectDetail'
import { AdminDashboard, AdminNotifications, AdminProviders, AdminSupport } from './AdminOps'
import { AdminCatalog, AdminCustomerDetail, AdminCustomers } from './AdminPlatform'

interface Me { email: string; role: string; csrfToken: string }
const AuthCtx = createContext<{ me: Me | null; logout: () => Promise<void> }>({ me: null, logout: async () => {} })
export const useAdmin = () => useContext(AuthCtx)

export function AdminApp() {
  const [me, setMe] = useState<Me | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    api<Me>('/admin/auth/me')
      .then((m) => { setCsrf(m.csrfToken); setMe(m) })
      .catch(() => setMe(null))
      .finally(() => setChecking(false))
  }, [])

  const logout = useCallback(async () => {
    try { await api('/admin/auth/logout', { method: 'POST', json: {} }) } catch { /* ignore */ }
    setCsrf(null); setMe(null)
  }, [])
  const logoutAll = useCallback(async () => {
    if (!confirm('Keluarkan SEMUA sesi admin di semua perangkat?')) return
    try { await api('/admin/auth/logout-all', { method: 'POST', json: {} }) } catch { /* ignore */ }
    setCsrf(null); setMe(null)
  }, [])

  // Step-up re-authentication dialog (docs/48 §5). The API asks; we prompt; the request is retried once.
  const [reauth, setReauth] = useState<null | ((ok: boolean) => void)>(null)
  useEffect(() => {
    setReauthHandler(() => new Promise<boolean>((resolve) => setReauth(() => resolve)))
    return () => setReauthHandler(null)
  }, [])

  if (checking) return <div className="admin-shell"><p className="muted pad" role="status">Memeriksa sesi…</p></div>
  if (!me) return <AdminLogin onLogin={(m) => { setCsrf(m.csrfToken); setMe(m) }} />

  return (
    <AuthCtx.Provider value={{ me, logout }}>
      <div className="admin-shell">
        <header className="admin-header">
          <Link to="/admin" className="brand-link"><Logo /> <span className="admin-badge">Studio</span></Link>
          <div className="admin-user">
            <span className="small muted">{me.email}</span>
            <button className="btn btn-ghost btn-sm" onClick={logoutAll} title="Cabut semua sesi">Keluar semua</button>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Keluar</button>
          </div>
        </header>
        <nav className="admin-nav" aria-label="Navigasi studio">
          <NavLink to="/admin" end>Inbox</NavLink>
          <NavLink to="/admin/dashboard">Dashboard</NavLink>
          <NavLink to="/admin/customers">Pelanggan</NavLink>
          <NavLink to="/admin/catalog">Katalog</NavLink>
          <NavLink to="/admin/notifications">Notifikasi</NavLink>
          <NavLink to="/admin/support">Dukungan</NavLink>
          <NavLink to="/admin/providers">Provider &amp; lisensi</NavLink>
        </nav>
        <main className="admin-main" id="main">
          {reauth && <ReauthDialog onDone={(ok) => { reauth(ok); setReauth(null) }} />}
          <Routes>
            <Route index element={<AdminInbox />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="support" element={<AdminSupport />} />
            <Route path="providers" element={<AdminProviders />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="customers/:id" element={<AdminCustomerDetail />} />
            <Route path="catalog" element={<AdminCatalog />} />
            <Route path="projects/:id" element={<AdminProjectDetail />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </AuthCtx.Provider>
  )
}

function AdminLogin({ onLogin }: { onLogin: (m: Me) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const m = await api<Me>('/admin/auth/login', { method: 'POST', json: { email, password } })
      onLogin(m)
      nav('/admin', { replace: true })
    } catch (err) {
      setError(err instanceof ApiFailure ? err.body.message : 'Gagal masuk')
    } finally { setBusy(false) }
  }

  return (
    <div className="admin-login">
      <form className="login-card" onSubmit={submit}>
        <Logo />
        <h1 className="h3">Masuk Studio</h1>
        {error && <Alert kind="error">{error}</Alert>}
        <Field id="email" label="Email" required>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field id="password" label="Kata sandi" required>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button>
        <Link to="/" className="small muted">← Kembali ke situs</Link>
      </form>
    </div>
  )
}

function ReauthDialog({ onDone }: { onDone: (ok: boolean) => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus() }, [])
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      await api('/admin/auth/reauth', { method: 'POST', json: { password } })
      setPassword('')
      onDone(true)
    } catch (err) {
      setError(err instanceof ApiFailure ? err.body.message : 'Gagal mengonfirmasi')
    } finally { setBusy(false) }
  }
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal panel" role="dialog" aria-modal="true" aria-labelledby="reauth-title" onSubmit={submit}>
        <h2 id="reauth-title" className="h4">Konfirmasi kata sandi</h2>
        <p className="small muted">Aksi ini sensitif (pembayaran, refund, ekspor, pencabutan tautan). Masukkan kata sandi lagi — berlaku 10 menit.</p>
        {error && <Alert kind="error">{error}</Alert>}
        <Field id="reauth-password" label="Kata sandi" required>
          <input ref={input} id="reauth-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <div className="btn-row">
          <button className="btn btn-primary" disabled={busy || !password}>{busy ? 'Memeriksa…' : 'Konfirmasi'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => onDone(false)}>Batal</button>
        </div>
      </form>
    </div>
  )
}
