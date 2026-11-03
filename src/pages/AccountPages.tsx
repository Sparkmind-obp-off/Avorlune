import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { SignIn, SignUp } from '@clerk/react'
import { PageHeader } from '../components/SiteLayout'
import { Alert, Field } from '../components/Field'
import { api, ApiFailure, formatDate } from '../lib/api'
import { safeRedirect, useCustomerAuth } from '../lib/auth'

function AuthUnavailable() {
  return (
    <section className="section"><div className="container narrow">
      <Alert kind="info">Akun pelanggan belum aktif di lingkungan ini. Anda tetap dapat <Link to="/start">mengirim brief</Link> dan memakai tautan proyek privat dari tim kami.</Alert>
    </div></section>
  )
}

function DevBanner() {
  const { instance } = useCustomerAuth()
  return instance === 'development'
    ? <p className="draft-banner" role="note"><strong>Lingkungan pengembangan.</strong> Login memakai Clerk Development instance — bukan untuk transaksi pelanggan sungguhan.</p>
    : null
}

export function SignInPage() {
  const auth = useCustomerAuth()
  const [params] = useSearchParams()
  const redirect = safeRedirect(params.get('redirect'))
  if (!auth.loaded) return <p className="muted pad" role="status">Memuat…</p>
  if (!auth.enabled) return <AuthUnavailable />
  return (
    <>
      <PageHeader eyebrow="Akun" title="Masuk" intro="Masuk untuk mengirim brief, melihat proyek, pembayaran dan file Anda." />
      <section className="section"><div className="container narrow auth-box">
        <DevBanner />
        <SignIn routing="path" path="/sign-in" signUpUrl={`/sign-up?redirect=${encodeURIComponent(redirect)}`} fallbackRedirectUrl={redirect} />
      </div></section>
    </>
  )
}

export function SignUpPage() {
  const auth = useCustomerAuth()
  const [params] = useSearchParams()
  const redirect = safeRedirect(params.get('redirect'), '/account?welcome=1')
  if (!auth.loaded) return <p className="muted pad" role="status">Memuat…</p>
  if (!auth.enabled) return <AuthUnavailable />
  return (
    <>
      <PageHeader eyebrow="Akun" title="Buat akun" intro="Gratis. Brief yang sudah Anda isi tetap tersimpan." />
      <section className="section"><div className="container narrow auth-box">
        <DevBanner />
        <SignUp routing="path" path="/sign-up" signInUrl={`/sign-in?redirect=${encodeURIComponent(redirect)}`} fallbackRedirectUrl={redirect} />
      </div></section>
    </>
  )
}

interface Me { id: string; email: string | null; displayName: string | null; onboarding: { completed: boolean; skipped: boolean }; createdAt: string }
interface MyProject { reference: string; title: string; status: string; statusLabel: string; offerName: string | null; createdAt: string; updatedAt: string }

export function AccountPage() {
  const auth = useCustomerAuth()
  const [me, setMe] = useState<Me | null>(null)
  const [projects, setProjects] = useState<MyProject[]>([])
  const [draft, setDraft] = useState<{ updatedAt: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')

  const load = useCallback(async () => {
    try {
      const [m, p, d] = await Promise.all([
        api<Me>('/account/me'),
        api<{ projects: MyProject[] }>('/account/me/projects'),
        api<{ updatedAt: string } | null>('/account/me/draft'),
      ])
      setMe(m); setProjects(p.projects); setDraft(d); setError(null)
    } catch (e) { setError(e instanceof ApiFailure ? e.body.message : 'Gagal memuat akun') }
  }, [])
  useEffect(() => { if (auth.signedIn) void load() }, [auth.signedIn, load])

  if (!auth.loaded) return <p className="muted pad" role="status">Memuat…</p>
  if (!auth.enabled) return <AuthUnavailable />
  if (!auth.signedIn) return <Navigate to="/sign-in?redirect=/account" replace />

  const onboarding = async (action: 'skip' | 'complete', e?: FormEvent) => {
    e?.preventDefault()
    try { await api('/account/me/onboarding', { method: 'POST', json: action === 'complete' ? { action, displayName: name || undefined } : { action } }); await load() }
    catch (err) { setError(err instanceof ApiFailure ? err.body.message : 'Gagal menyimpan') }
  }

  return (
    <>
      <PageHeader eyebrow="Akun" title={me?.displayName ? `Halo, ${me.displayName}` : 'Akun Anda'} />
      <section className="section"><div className="container narrow" id="account-page">
        <DevBanner />
        {error && <Alert kind="error">{error}</Alert>}
        {me && !me.onboarding.completed && !me.onboarding.skipped && (
          <article className="panel" id="onboarding">
            <h2 className="h4">Selamat datang</h2>
            <p className="muted">Opsional — Anda bisa langsung melihat layanan.</p>
            <form onSubmit={(e) => onboarding('complete', e)}>
              <Field id="display-name" label="Nama panggilan"><input id="display-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" /></Field>
              <div className="btn-row">
                <button className="btn btn-primary" disabled={name.trim().length < 2}>Simpan</button>
                <button type="button" className="btn btn-ghost" onClick={() => onboarding('skip')}>Lewati</button>
                <Link to="/catalog" className="btn btn-ghost">Lihat layanan</Link>
              </div>
            </form>
          </article>
        )}
        {draft && (
          <article className="panel">
            <h2 className="h4">Draf brief</h2>
            <p className="small muted">Disimpan {formatDate(draft.updatedAt, true)}.</p>
            <Link to="/start" className="btn btn-primary btn-sm">Lanjutkan brief</Link>
          </article>
        )}
        <article className="panel" id="my-projects">
          <h2 className="h4">Proyek saya</h2>
          {projects.length === 0 ? (
            <p className="muted">Belum ada proyek di akun ini. <Link to="/catalog">Lihat layanan</Link> atau <Link to="/start">kirim brief</Link>.</p>
          ) : (
            <ul className="ops-list">
              {projects.map((p) => (
                <li key={p.reference}>
                  <Link to={`/p/${p.reference}`}><strong>{p.title}</strong></Link>
                  <div className="small muted"><span className="mono">{p.reference}</span>{p.offerName ? ` · ${p.offerName}` : ''} · {formatDate(p.createdAt)} · <span className={`status-pill s-${p.status}`}>{p.statusLabel}</span></div>
                </li>
              ))}
            </ul>
          )}
          <p className="small muted">Proyek yang dibuat sebelum Anda punya akun tetap diakses lewat tautan privat dari tim kami; kami tidak menggabungkannya otomatis berdasarkan email.</p>
        </article>
      </div></section>
    </>
  )
}
