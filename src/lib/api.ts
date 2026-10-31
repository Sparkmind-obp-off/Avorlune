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

export async function api<T>(path: string, init: RequestInit & { json?: unknown; projectToken?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')
  if (init.json !== undefined) headers.set('content-type', 'application/json')
  if (csrfToken && init.method && init.method !== 'GET') headers.set('x-csrf-token', csrfToken)
  if (init.projectToken) headers.set('x-project-token', init.projectToken)
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
    throw new ApiFailure(res.status, payload?.error ?? { code: 'UNKNOWN', message: `Permintaan gagal (${res.status})` })
  }
  return payload.data as T
}

export const formatDate = (iso: string | null | undefined, withTime = false) =>
  iso
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', ...(withTime ? { timeStyle: 'short' } : {}) }).format(new Date(iso))
    : '—'
