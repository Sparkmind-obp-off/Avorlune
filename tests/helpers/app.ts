import { createApp } from '../../server/app'
import { hashPassword } from '../../server/lib/crypto'
import { createTestD1 } from './d1'
import { createMemoryStore } from './store'
import type { Env } from '../../server/env'

export const ADMIN_EMAIL = 'producer@example.test'
export const ADMIN_PASSWORD = 'correct-horse-battery-staple'
let cachedHash: string | null = null

export const DUITKU_TEST = { merchantCode: 'DTEST1', apiKey: 'test-duitku-api-key-0123456789abcdef' }

export const CLERK_TEST = { host: 'test-instance.clerk.accounts.dev', origin: 'https://avorlune.test' }
export const CLERK_TEST_PK = `pk_test_${Buffer.from(`${CLERK_TEST.host}$`).toString('base64')}`

export async function setup(opts: { assets?: boolean; appEnv?: string; marker?: string | null; noDb?: boolean; duitku?: boolean; checkout?: boolean; clerk?: boolean; briefRequiresAccount?: boolean } = {}) {
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
    ...(opts.clerk ? { CLERK_PUBLISHABLE_KEY: CLERK_TEST_PK, CLERK_AUTHORIZED_PARTIES: CLERK_TEST.origin, ...(opts.briefRequiresAccount ? { CUSTOMER_AUTH_REQUIRED_FOR_BRIEF: 'true' } : {}) } : {}),
    ...(opts.duitku ? { DUITKU_ENV: 'sandbox', DUITKU_MERCHANT_CODE: DUITKU_TEST.merchantCode, DUITKU_API_KEY: DUITKU_TEST.apiKey, DUITKU_CHECKOUT_ENABLED: opts.checkout === false ? 'false' : 'true' } : {}),
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
  const form = async (path: string, fields: Record<string, string>, ip?: string) => {
    const res = await app.request(`https://avorlune.test/api/v1${path}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'cf-connecting-ip': ip ?? nextIp() }, body: new URLSearchParams(fields).toString() }, env)
    return { status: res.status, text: await res.text() }
  }
  return { app, env, raw, call, upload, form, objects: mem.objects }
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
  // 50/50 schedule: the deposit (50%) is what unlocks production.
  const dep = await ctx.call('POST', `/admin/projects/${id}/payments/confirm`, { json: { amountMinor: 500000, method: 'Transfer bank' }, headers: auth })
  if (dep.status !== 201) throw new Error(`deposit: ${JSON.stringify(dep.body)}`)
  for (const s of ['awaiting_payment', 'queued', 'producing', 'internal_review', 'customer_review']) await patch(s)
  return { id, reference, token, patch }
}

/** Record the 50% balance (manual, audited) — required before final delivery. */
export async function payBalance(ctx: Awaited<ReturnType<typeof setup>>, auth: Record<string, string>, projectId: string, amountMinor = 500000) {
  const r = await ctx.call('POST', `/admin/projects/${projectId}/payments/confirm`, { json: { amountMinor, method: 'Transfer bank' }, headers: auth })
  if (r.status !== 201) throw new Error(`balance: ${JSON.stringify(r.body)}`)
  return r
}
