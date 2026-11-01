import { createApp } from '../../server/app'
import { hashPassword } from '../../server/lib/crypto'
import { createTestD1 } from './d1'
import { createMemoryStore } from './store'
import type { Env } from '../../server/env'

export const ADMIN_EMAIL = 'producer@example.test'
export const ADMIN_PASSWORD = 'correct-horse-battery-staple'
let cachedHash: string | null = null

export async function setup(opts: { assets?: boolean; appEnv?: string; marker?: string | null; noDb?: boolean } = {}) {
  cachedHash ??= await hashPassword(ADMIN_PASSWORD, 10_000)
  const { d1, raw } = createTestD1()
  const marker = opts.marker === undefined ? 'test' : opts.marker
  if (marker) raw.prepare(`INSERT INTO app_meta (key, value, updated_at) VALUES ('environment', ?, ?)`).run(marker, new Date().toISOString())
  const mem = createMemoryStore()
  const env: Env = {
    DB: opts.noDb ? undefined : d1,
    APP_ENV: opts.appEnv ?? 'test',
    LINK_SIGNING_SECRET: 'test-secret-'.padEnd(64, 'x'),
    ADMIN_EMAIL,
    ADMIN_PASSWORD_HASH: cachedHash,
    ...(opts.assets ? { DELIVERY_BUCKET: mem.store } : {}),
  }
  const app = createApp()
  let ipCounter = 0
  const nextIp = () => `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`
  const call = async (method: string, path: string, o: { json?: unknown; headers?: Record<string, string>; ip?: string } = {}) => {
    const headers: Record<string, string> = { 'cf-connecting-ip': o.ip ?? nextIp(), ...o.headers }
    let body: string | undefined
    if (o.json !== undefined) {
      headers['content-type'] = 'application/json'
      body = JSON.stringify(o.json)
    }
    const res = await app.request(`https://avorlune.test/api/v1${path}`, { method, headers, body }, env)
    const ct = res.headers.get('content-type') ?? ''
    const data = ct.includes('application/json') ? await res.json().catch(() => null) : null
    const bytes = ct.includes('application/json') ? null : new Uint8Array(await res.arrayBuffer())
    return { status: res.status, body: data as any, bytes, headers: res.headers } // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  const upload = async (projectId: string, kind: string, bytes: Uint8Array, auth: Record<string, string>, filename = 'hasil.png') => {
    const res = await app.request(
      `https://avorlune.test/api/v1/admin/projects/${projectId}/assets?kind=${kind}&filename=${encodeURIComponent(filename)}`,
      { method: 'POST', headers: { ...auth, 'cf-connecting-ip': nextIp(), 'content-type': 'application/octet-stream', 'content-length': String(bytes.byteLength) }, body: bytes },
      env,
    )
    return { status: res.status, body: (await res.json().catch(() => null)) as any } // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  return { app, env, raw, call, upload, objects: mem.objects }
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

type Call = Awaited<ReturnType<typeof setup>>['call']

export async function loginAdmin(call: Call) {
  const res = await call('POST', '/admin/auth/login', { json: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
  if (res.status !== 200) throw new Error(`login failed: ${JSON.stringify(res.body)}`)
  const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]
  const csrf = res.body.data.csrfToken as string
  return { cookie, csrf, auth: { cookie, 'x-csrf-token': csrf } as Record<string, string> }
}

/** Drives a fresh inquiry to customer_review (quote sent/accepted, payment confirmed). Returns ids + customer token. */
export async function toCustomerReview(ctx: Awaited<ReturnType<typeof setup>>, auth: Record<string, string>, overrides: Record<string, unknown> = {}) {
  const r = await ctx.call('POST', '/inquiries', { json: validInquiry(overrides) })
  const reference = r.body.data.reference as string
  const { id } = ctx.raw.prepare('SELECT id FROM projects WHERE public_reference = ?').get(reference) as { id: string }
  const patch = async (toStatus: string, extra: Record<string, unknown> = {}) => {
    const res = await ctx.call('PATCH', `/admin/projects/${id}/status`, { json: { toStatus, ...extra }, headers: auth })
    if (res.status !== 200) throw new Error(`${toStatus}: ${JSON.stringify(res.body)}`)
  }
  await patch('qualifying')
  await ctx.call('POST', `/admin/projects/${id}/quotes`, { json: { amountMinor: 1000000, deliverables: ['2 gambar 1:1'], includedRevisionRounds: 1, status: 'sent' }, headers: auth })
  await patch('quoted')
  const link = await ctx.call('POST', `/admin/projects/${id}/access-link`, { json: {}, headers: auth })
  const token = (link.body.data.url as string).split('#t=')[1]
  await ctx.call('POST', `/projects/${reference}/quote/decision`, { json: { decision: 'accepted' }, headers: { 'x-project-token': token } })
  await ctx.call('POST', `/admin/projects/${id}/payments/confirm`, { json: { amountMinor: 1000000, method: 'Transfer bank' }, headers: auth })
  for (const s of ['awaiting_payment', 'queued', 'producing', 'internal_review', 'customer_review']) await patch(s)
  return { id, reference, token, patch }
}
