import { createContext, useCallback, useContext, useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Logo } from '../../components/SiteLayout'
import { Alert, Field } from '../../components/Field'
import { api, ApiFailure, setCsrf } from '../../lib/api'
import { AdminInbox } from './AdminInbox'
import { AdminProjectDetail } from './AdminProjectDetail'

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

  if (checking) return <div className="admin-shell"><p className="muted pad" role="status">Memeriksa sesi…</p></div>
  if (!me) return <AdminLogin onLogin={(m) => { setCsrf(m.csrfToken); setMe(m) }} />

  return (
    <AuthCtx.Provider value={{ me, logout }}>
      <div className="admin-shell">
        <header className="admin-header">
          <Link to="/admin" className="brand-link"><Logo /> <span className="admin-badge">Studio</span></Link>
          <div className="admin-user">
            <span className="small muted">{me.email}</span>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Keluar</button>
          </div>
        </header>
        <main className="admin-main" id="main">
          <Routes>
            <Route index element={<AdminInbox />} />
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
