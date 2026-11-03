export interface ApiErrorBody {
  code: string
  message: string
  details?: { fields?: Record<string, string> }
}

export class ApiFailure extends Error {
  constructor(public status: number, public body: ApiErrorBody) {
    super(body.message)
  }
}

let csrfToken: string | null = null
export const setCsrf = (t: string | null) => {
  csrfToken = t
}

/** Customer session token getter (Clerk). Attached only to non-admin API calls that do not carry a project link token. */
let authTokenGetter: (() => Promise<string | null>) | null = null
export const setAuthTokenGetter = (fn: (() => Promise<string | null>) | null) => {
  authTokenGetter = fn
}
async function customerBearer(path: string, projectToken?: string) {
  if (projectToken || path.startsWith('/admin') || !authTokenGetter) return null
  try { return await authTokenGetter() } catch { return null }
}

/** Step-up handler (admin): asks for the password again; resolves true when re-authenticated. */
let reauthHandler: (() => Promise<boolean>) | null = null
export const setReauthHandler = (fn: (() => Promise<boolean>) | null) => {
  reauthHandler = fn
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown; projectToken?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')
  if (init.json !== undefined) headers.set('content-type', 'application/json')
  if (csrfToken && init.method && init.method !== 'GET') headers.set('x-csrf-token', csrfToken)
  if (init.projectToken) headers.set('x-project-token', init.projectToken)
  const bearer = await customerBearer(path, init.projectToken)
  if (bearer) headers.set('authorization', `Bearer ${bearer}`)
  let res: Response
  try {
    res = await fetch(`/api/v1${path}`, {
      ...init,
      headers,
      credentials: 'same-origin',
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    })
  } catch {
    throw new ApiFailure(0, { code: 'NETWORK_ERROR', message: 'Tidak dapat terhubung ke server. Periksa koneksi Anda.' })
  }
  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    // Sensitive admin action: re-confirm the password once, then retry the same request exactly once.
    if (res.status === 403 && payload?.error?.code === 'REAUTH_REQUIRED' && reauthHandler && !(init as { _retried?: boolean })._retried) {
      if (await reauthHandler()) return api<T>(path, { ...init, _retried: true } as typeof init)
    }
    throw new ApiFailure(res.status, payload?.error ?? { code: 'UNKNOWN', message: `Permintaan gagal (${res.status})` })
  }
  return payload.data as T
}

export const formatDate = (iso: string | null | undefined, withTime = false) =>
  iso
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', ...(withTime ? { timeStyle: 'short' } : {}) }).format(new Date(iso))
    : '—'

/** Raw binary upload (admin). */
export async function uploadBinary<T>(path: string, file: File): Promise<T> {
  const headers = new Headers({ accept: 'application/json', 'content-type': 'application/octet-stream' })
  if (csrfToken) headers.set('x-csrf-token', csrfToken)
  const res = await fetch(`/api/v1${path}`, { method: 'POST', headers, body: file, credentials: 'same-origin' }).catch(() => null)
  if (!res) throw new ApiFailure(0, { code: 'NETWORK_ERROR', message: 'Tidak dapat terhubung ke server.' })
  const payload = await res.json().catch(() => null)
  if (!res.ok) throw new ApiFailure(res.status, payload?.error ?? { code: 'UNKNOWN', message: `Unggah gagal (${res.status})` })
  return payload.data as T
}

/** Authorized download: credentials travel in headers, never in the URL. */
export async function downloadFile(path: string, filename: string, projectToken?: string) {
  const headers = new Headers()
  if (projectToken) headers.set('x-project-token', projectToken)
  const bearer = await customerBearer(path, projectToken)
  if (bearer) headers.set('authorization', `Bearer ${bearer}`)
  const res = await fetch(`/api/v1${path}`, { headers, credentials: 'same-origin' }).catch(() => null)
  if (!res || !res.ok) {
    const payload = res ? await res.json().catch(() => null) : null
    throw new ApiFailure(res?.status ?? 0, payload?.error ?? { code: 'DOWNLOAD_FAILED', message: 'Unduhan gagal' })
  }
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export const formatBytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

export interface AssetInfo { id: string; kind: string; mimeType: string; sizeBytes: number; version: number; filename: string | null; status: string; createdAt: string }
