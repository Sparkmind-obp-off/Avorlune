import { beforeEach, describe, expect, it } from 'vitest'
import { ADMIN_EMAIL, loginAdmin, setup, validInquiry } from '../helpers/app'

type Ctx = Awaited<ReturnType<typeof setup>>
let ctx: Ctx

beforeEach(async () => {
  ctx = await setup()
})

async function createInquiry(overrides: Record<string, unknown> = {}) {
  const r = await ctx.call('POST', '/inquiries', { json: validInquiry(overrides) })
  expect(r.status).toBe(201)
  const row = ctx.raw.prepare('SELECT id FROM projects WHERE public_reference = ?').get(r.body.data.reference) as { id: string }
  return { reference: r.body.data.reference as string, id: row.id }
}

describe('public endpoints', () => {
  it('health exposes no infrastructure details', async () => {
    const r = await ctx.call('GET', '/health')
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual({ status: 'ok' })
    expect(r.body.requestId).toBeTruthy()
    expect(r.headers.get('cache-control')).toBe('no-store')
  })
  it('services contain no published prices; portfolio is empty until rights-cleared', async () => {
    const s = await ctx.call('GET', '/services')
    expect(s.body.data).toHaveLength(2)
    expect(JSON.stringify(s.body.data)).not.toMatch(/Rp\s?\d/)
    const p = await ctx.call('GET', '/portfolio')
    expect(p.body.data).toEqual([])
  })
  it('unknown endpoints return the consistent error shape', async () => {
    const r = await ctx.call('GET', '/nope')
    expect(r.status).toBe(404)
    expect(r.body.error.code).toBe('NOT_FOUND')
  })
})

describe('POST /inquiries', () => {
  it('persists a valid inquiry exactly once with an audit event', async () => {
    const { reference, id } = await createInquiry()
    expect(reference).toMatch(/^AVL-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    const p = ctx.raw.prepare('SELECT status FROM projects WHERE id = ?').get(id) as { status: string }
    expect(p.status).toBe('inquiry')
    const ev = ctx.raw.prepare('SELECT event_type, safe_metadata_json FROM project_events WHERE project_id = ?').all(id) as { event_type: string; safe_metadata_json: string }[]
    expect(ev.map((e) => e.event_type)).toEqual(['inquiry_created'])
    expect(ev[0].safe_metadata_json).not.toContain('sinta@example.test')
  })
  it('rejects invalid input with field errors', async () => {
    const r = await ctx.call('POST', '/inquiries', { json: validInquiry({ name: '', consent: false }) })
    expect(r.status).toBe(422)
    expect(r.body.error.code).toBe('VALIDATION_ERROR')
    expect(r.body.error.details.fields).toHaveProperty('name')
    expect(r.body.error.details.fields).toHaveProperty('consent')
  })
  it('rejects non-JSON and malformed JSON', async () => {
    const a = await ctx.app.request('https://avorlune.test/api/v1/inquiries', { method: 'POST', body: 'x', headers: { 'content-type': 'text/plain' } }, ctx.env)
    expect(a.status).toBe(415)
    const b = await ctx.app.request('https://avorlune.test/api/v1/inquiries', { method: 'POST', body: '{bad', headers: { 'content-type': 'application/json' } }, ctx.env)
    expect(b.status).toBe(400)
  })
  it('rejects honeypot and too-fast submissions', async () => {
    expect((await ctx.call('POST', '/inquiries', { json: validInquiry({ formStartedAt: Date.now() }) })).status).toBe(422)
    expect((await ctx.call('POST', '/inquiries', { json: validInquiry({ website: 'x' }) })).status).toBe(422)
    expect((ctx.raw.prepare('SELECT COUNT(*) n FROM projects').get() as { n: number }).n).toBe(0)
  })
  it('deduplicates retries with the same Idempotency-Key', async () => {
    const headers = { 'idempotency-key': 'retry-key-1234567890abcd' }
    const a = await ctx.call('POST', '/inquiries', { json: validInquiry(), headers })
    const b = await ctx.call('POST', '/inquiries', { json: validInquiry(), headers })
    expect(a.status).toBe(201)
    expect(b.status).toBe(200)
    expect(b.body.data).toEqual({ reference: a.body.data.reference, duplicate: true })
    expect((ctx.raw.prepare('SELECT COUNT(*) n FROM projects').get() as { n: number }).n).toBe(1)
  })
  it('rate-limits abusive clients per IP', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 7; i++) statuses.push((await ctx.call('POST', '/inquiries', { json: validInquiry(), ip: '203.0.113.9' })).status)
    expect(statuses.slice(0, 5).every((s) => s === 201)).toBe(true)
    expect(statuses.slice(5)).toEqual([429, 429])
    // Raw IPs are never stored.
    const keys = ctx.raw.prepare('SELECT bucket_key FROM rate_limits').all() as { bucket_key: string }[]
    expect(keys.some((k) => k.bucket_key.includes('203.0.113.9'))).toBe(false)
  })
})

describe('admin authentication & authorization', () => {
  it('denies unauthenticated access to admin endpoints', async () => {
    const { id } = await createInquiry()
    for (const [m, path] of [['GET', '/admin/projects'], ['GET', `/admin/projects/${id}`], ['PATCH', `/admin/projects/${id}/status`], ['POST', `/admin/projects/${id}/quotes`]] as const) {
      const r = await ctx.call(m, path, { json: m === 'GET' ? undefined : {} })
      expect(r.status, `${m} ${path}`).toBe(401)
    }
  })
  it('rejects wrong credentials and sets a hardened cookie on success', async () => {
    expect((await ctx.call('POST', '/admin/auth/login', { json: { email: ADMIN_EMAIL, password: 'nope' } })).status).toBe(401)
    expect((await ctx.call('POST', '/admin/auth/login', { json: { email: 'other@example.test', password: 'correct-horse-battery-staple' } })).status).toBe(401)
    const r = await ctx.call('POST', '/admin/auth/login', { json: { email: ADMIN_EMAIL, password: 'correct-horse-battery-staple' } })
    expect(r.status).toBe(200)
    const cookie = r.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Strict/i)
    expect(cookie).toMatch(/Secure/i)
    // Raw session token is not stored, only its hash.
    const token = cookie.split(';')[0].split('=')[1]
    expect((ctx.raw.prepare('SELECT COUNT(*) n FROM sessions WHERE id_hash = ?').get(token) as { n: number }).n).toBe(0)
  })
  it('requires a valid CSRF token for state changes', async () => {
    const { id } = await createInquiry()
    const { cookie } = await loginAdmin(ctx.call)
    const noCsrf = await ctx.call('PATCH', `/admin/projects/${id}/status`, { json: { toStatus: 'qualifying' }, headers: { cookie } })
    expect(noCsrf.status).toBe(403)
    const bad = await ctx.call('PATCH', `/admin/projects/${id}/status`, { json: { toStatus: 'qualifying' }, headers: { cookie, 'x-csrf-token': 'forged' } })
    expect(bad.status).toBe(403)
  })
  it('rejects cross-origin state changes even with a CSRF token', async () => {
    const { id } = await createInquiry()
    const { auth } = await loginAdmin(ctx.call)
    const r = await ctx.call('PATCH', `/admin/projects/${id}/status`, { json: { toStatus: 'qualifying' }, headers: { ...auth, origin: 'https://evil.example' } })
    expect(r.status).toBe(403)
  })
  it('logout invalidates the session', async () => {
    const { auth } = await loginAdmin(ctx.call)
    expect((await ctx.call('POST', '/admin/auth/logout', { json: {}, headers: auth })).status).toBe(200)
    expect((await ctx.call('GET', '/admin/projects', { headers: auth })).status).toBe(401)
  })
  it('lists, filters and paginates the inbox', async () => {
    await createInquiry()
    await createInquiry({ serviceType: 'video', title: 'Video teaser kampanye' })
    const { auth } = await loginAdmin(ctx.call)
    const all = await ctx.call('GET', '/admin/projects', { headers: auth })
    expect(all.body.data.total).toBe(2)
    expect(all.body.data.statusCounts.inquiry).toBe(2)
    const q = await ctx.call('GET', '/admin/projects?q=teaser', { headers: auth })
    expect(q.body.data.items).toHaveLength(1)
    const bad = await ctx.call('GET', '/admin/projects?status=hacked', { headers: auth })
    expect(bad.status).toBe(422)
  })
})

describe('project lifecycle rules', () => {
  it('rejects invalid transitions server-side', async () => {
    const { id } = await createInquiry()
    const { auth } = await loginAdmin(ctx.call)
    const r = await ctx.call('PATCH', `/admin/projects/${id}/status`, { json: { toStatus: 'delivered' }, headers: auth })
    expect(r.status).toBe(409)
    expect(r.body.error.code).toBe('INVALID_TRANSITION')
  })
  it('requires a sent quote before "quoted", payment or reason before "queued", and reason to cancel', async () => {
    const { id } = await createInquiry()
    const { auth } = await loginAdmin(ctx.call)
    const patch = (json: unknown) => ctx.call('PATCH', `/admin/projects/${id}/status`, { json, headers: auth })
    expect((await patch({ toStatus: 'qualifying' })).status).toBe(200)
    expect((await patch({ toStatus: 'quoted' })).body.error.code).toBe('QUOTE_REQUIRED')
    await ctx.call('POST', `/admin/projects/${id}/quotes`, { json: { amountMinor: 1500000, deliverables: ['3 gambar 1:1'], includedRevisionRounds: 1, status: 'sent' }, headers: auth })
    expect((await patch({ toStatus: 'quoted' })).status).toBe(200)
    expect((await patch({ toStatus: 'queued' })).body.error.code).toBe('PAYMENT_REQUIRED')
    expect((await patch({ toStatus: 'cancelled' })).body.error.code).toBe('REASON_REQUIRED')
    expect((await patch({ toStatus: 'queued', reason: 'DP disepakati via email, pengecualian disetujui' })).status).toBe(200)
  })
  it('stores money as integers and rejects fractional amounts', async () => {
    const { id } = await createInquiry()
    const { auth } = await loginAdmin(ctx.call)
    await ctx.call('PATCH', `/admin/projects/${id}/status`, { json: { toStatus: 'qualifying' }, headers: auth })
    const r = await ctx.call('POST', `/admin/projects/${id}/quotes`, { json: { amountMinor: 10.5, deliverables: ['x item'], includedRevisionRounds: 1 }, headers: auth })
    expect(r.status).toBe(422)
  })
  it('records internal notes without exposing them to customers', async () => {
    const { id, reference } = await createInquiry()
    const { auth } = await loginAdmin(ctx.call)
    await ctx.call('POST', `/admin/projects/${id}/events`, { json: { note: 'RAHASIA-INTERNAL margin tipis' }, headers: auth })
    const link = await ctx.call('POST', `/admin/projects/${id}/access-link`, { json: {}, headers: auth })
    const token = link.body.data.url.split('#t=')[1]
    const cust = await ctx.call('GET', `/projects/${reference}`, { headers: { 'x-project-token': token } })
    expect(cust.status).toBe(200)
    expect(JSON.stringify(cust.body)).not.toContain('RAHASIA-INTERNAL')
    expect(JSON.stringify(cust.body)).not.toContain('sinta@example.test')
  })
})

describe('customer access isolation', () => {
  it('customer A token cannot read or mutate project B', async () => {
    const a = await createInquiry()
    const b = await createInquiry({ title: 'Proyek milik B' })
    const { auth } = await loginAdmin(ctx.call)
    const linkA = await ctx.call('POST', `/admin/projects/${a.id}/access-link`, { json: {}, headers: auth })
    const tokenA = linkA.body.data.url.split('#t=')[1]
    expect((await ctx.call('GET', `/projects/${a.reference}`, { headers: { 'x-project-token': tokenA } })).status).toBe(200)
    const cross = await ctx.call('GET', `/projects/${b.reference}`, { headers: { 'x-project-token': tokenA } })
    expect(cross.status).toBe(404)
    const crossWrite = await ctx.call('POST', `/projects/${b.reference}/approval`, { json: {}, headers: { 'x-project-token': tokenA } })
    expect(crossWrite.status).toBe(404)
  })
  it('missing, tampered and revoked tokens are denied identically', async () => {
    const a = await createInquiry()
    const { auth } = await loginAdmin(ctx.call)
    const link1 = await ctx.call('POST', `/admin/projects/${a.id}/access-link`, { json: {}, headers: auth })
    const t1 = link1.body.data.url.split('#t=')[1]
    expect((await ctx.call('GET', `/projects/${a.reference}`)).status).toBe(404)
    expect((await ctx.call('GET', `/projects/${a.reference}`, { headers: { 'x-project-token': t1.slice(0, -2) + 'xx' } })).status).toBe(404)
    await ctx.call('POST', `/admin/projects/${a.id}/access-link?revokePrevious=true`, { json: {}, headers: auth })
    const revoked = await ctx.call('GET', `/projects/${a.reference}`, { headers: { 'x-project-token': t1 } })
    expect(revoked.status).toBe(404)
    expect(revoked.body.error.message).toBe('Proyek tidak ditemukan atau tautan akses tidak berlaku')
  })
  it('customers cannot set arbitrary status or payment state', async () => {
    const a = await createInquiry()
    const { auth } = await loginAdmin(ctx.call)
    const link = await ctx.call('POST', `/admin/projects/${a.id}/access-link`, { json: {}, headers: auth })
    const t = link.body.data.url.split('#t=')[1]
    // Approval outside customer_review is refused.
    expect((await ctx.call('POST', `/projects/${a.reference}/approval`, { json: {}, headers: { 'x-project-token': t } })).status).toBe(409)
    // Customer token cannot reach admin endpoints.
    expect((await ctx.call('PATCH', `/admin/projects/${a.id}/status`, { json: { toStatus: 'delivered' }, headers: { 'x-project-token': t } })).status).toBe(401)
    expect((await ctx.call('POST', `/admin/projects/${a.id}/payments/confirm`, { json: { amountMinor: 1, method: 'x' }, headers: { 'x-project-token': t } })).status).toBe(401)
  })
})

describe('critical end-to-end scenario (docs/15)', () => {
  it('inquiry → quote → payment → production → review → revision → approval → delivered, fully audited', async () => {
    const { id, reference } = await createInquiry()
    const { auth } = await loginAdmin(ctx.call)
    const patch = async (toStatus: string, reason?: string) => {
      const r = await ctx.call('PATCH', `/admin/projects/${id}/status`, { json: { toStatus, reason }, headers: auth })
      expect(r.status, `${toStatus}: ${JSON.stringify(r.body)}`).toBe(200)
    }
    await patch('qualifying')
    const q = await ctx.call('POST', `/admin/projects/${id}/quotes`, { json: { amountMinor: 2500000, deliverables: ['5 gambar 4:5', '1 key visual 16:9'], includedRevisionRounds: 1, estimatedDeliveryAt: '2030-01-20', status: 'sent' }, headers: auth })
    expect(q.status).toBe(201)
    await patch('quoted')

    const link = await ctx.call('POST', `/admin/projects/${id}/access-link`, { json: {}, headers: auth })
    const token = link.body.data.url.split('#t=')[1]
    const h = { 'x-project-token': token }
    let view = await ctx.call('GET', `/projects/${reference}`, { headers: h })
    expect(view.body.data.actions.canDecideQuote).toBe(true)
    expect(view.body.data.quote.amountMinor).toBe(2500000)
    expect((await ctx.call('POST', `/projects/${reference}/quote/decision`, { json: { decision: 'accepted' }, headers: h })).status).toBe(200)
    expect((await ctx.call('POST', `/projects/${reference}/quote/decision`, { json: { decision: 'accepted' }, headers: h })).status).toBe(409)

    await patch('awaiting_payment')
    expect((await ctx.call('POST', `/admin/projects/${id}/payments/confirm`, { json: { amountMinor: 2500000, method: 'Transfer bank', providerReference: 'TRX-TEST-1' }, headers: auth })).status).toBe(201)
    await patch('queued')
    await patch('producing')
    await patch('internal_review')
    await patch('customer_review')

    const fb = await ctx.call('POST', `/projects/${reference}/feedback`, { json: { message: 'Mohon latar dibuat lebih hangat.' }, headers: h })
    expect(fb.status).toBe(201)
    expect(fb.body.data).toMatchObject({ revisionRound: 1, withinScope: true })
    view = await ctx.call('GET', `/projects/${reference}`, { headers: h })
    expect(view.body.data.status).toBe('revision')

    await patch('producing')
    await patch('internal_review')
    await patch('customer_review')
    const fb2 = await ctx.call('POST', `/projects/${reference}/feedback`, { json: { message: 'Satu lagi: ganti warna teks.' }, headers: h })
    expect(fb2.body.data).toMatchObject({ revisionRound: 2, withinScope: false })

    await patch('producing')
    await patch('internal_review')
    await patch('customer_review')
    expect((await ctx.call('POST', `/projects/${reference}/approval`, { json: {}, headers: h })).status).toBe(200)
    await patch('delivered')

    const detail = await ctx.call('GET', `/admin/projects/${id}`, { headers: auth })
    const types = (detail.body.data.events as { event_type: string; to_status: string | null; actor_type: string }[]).reverse()
    const statusSeq = types.filter((e) => e.event_type === 'status_changed').map((e) => e.to_status)
    expect(statusSeq).toEqual([
      'qualifying', 'quoted', 'awaiting_payment', 'queued', 'producing', 'internal_review', 'customer_review', 'revision',
      'producing', 'internal_review', 'customer_review', 'revision', 'producing', 'internal_review', 'customer_review', 'approved', 'delivered',
    ])
    expect(types.find((e) => e.to_status === 'approved')?.actor_type).toBe('customer')
    expect(types.some((e) => e.event_type === 'payment_manually_confirmed')).toBe(true)
    expect(types.some((e) => e.event_type === 'quote_accepted')).toBe(true)
    expect(detail.body.data.project).not.toHaveProperty('access_token_version')

    const exp = await ctx.call('GET', `/admin/projects/${id}/export`, { headers: auth })
    expect(exp.status).toBe(200)
    expect(exp.body.data.events.length).toBe(types.length)
  })

  it('a stale concurrent transition writes nothing', async () => {
    const { id } = await createInquiry()
    const { auth } = await loginAdmin(ctx.call)
    const [a, b] = await Promise.all([
      ctx.call('PATCH', `/admin/projects/${id}/status`, { json: { toStatus: 'qualifying' }, headers: auth }),
      ctx.call('PATCH', `/admin/projects/${id}/status`, { json: { toStatus: 'qualifying' }, headers: auth }),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    const n = ctx.raw.prepare(`SELECT COUNT(*) n FROM project_events WHERE project_id = ? AND event_type = 'status_changed'`).get(id) as { n: number }
    expect(n.n).toBe(1)
  })
})
