import { createApp } from '../../server/app'
import { hashPassword } from '../../server/lib/crypto'
import { createTestD1 } from './d1'
import type { Env } from '../../server/env'

export const ADMIN_EMAIL = 'producer@example.test'
export const ADMIN_PASSWORD = 'correct-horse-battery-staple'
let cachedHash: string | null = null

export async function setup() {
  cachedHash ??= await hashPassword(ADMIN_PASSWORD, 10_000)
  const { d1, raw } = createTestD1()
  const env: Env = { DB: d1, APP_ENV: 'test', LINK_SIGNING_SECRET: 'test-secret-'.padEnd(64, 'x'), ADMIN_EMAIL, ADMIN_PASSWORD_HASH: cachedHash }
  const app = createApp()
  let ipCounter = 0
  const call = async (method: string, path: string, opts: { json?: unknown; headers?: Record<string, string>; ip?: string } = {}) => {
    const headers: Record<string, string> = { 'cf-connecting-ip': opts.ip ?? `10.0.0.${++ipCounter % 250}`, ...opts.headers }
    let body: string | undefined
    if (opts.json !== undefined) {
      headers['content-type'] = 'application/json'
      body = JSON.stringify(opts.json)
    }
    const res = await app.request(`https://avorlune.test/api/v1${path}`, { method, headers, body }, env)
    const data = await res.json().catch(() => null)
    return { status: res.status, body: data as any, headers: res.headers } // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  return { app, env, raw, call }
}

export function validInquiry(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Sinta Contoh',
    contactMethod: 'email',
    contactValue: 'sinta@example.test',
    serviceType: 'image',
    title: 'Visual peluncuran produk',
    objective: 'Meningkatkan awareness produk baru untuk audiens 25-35.',
    description: 'Butuh lima visual produk bergaya editorial minimalis dengan latar hangat dan natural.',
    intendedUse: 'Instagram feed',
    desiredFormat: '5 gambar 4:5',
    deadlinePreference: 'flexible',
    referenceLinks: [],
    budgetRange: 'undisclosed',
    consent: true,
    rightsConfirmed: true,
    website: '',
    formStartedAt: Date.now() - 60_000,
    ...overrides,
  }
}

export async function loginAdmin(call: Awaited<ReturnType<typeof setup>>['call']) {
  const res = await call('POST', '/admin/auth/login', { json: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
  if (res.status !== 200) throw new Error(`login failed: ${JSON.stringify(res.body)}`)
  const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]
  const csrf = res.body.data.csrfToken as string
  return { cookie, csrf, auth: { cookie, 'x-csrf-token': csrf } as Record<string, string> }
}
