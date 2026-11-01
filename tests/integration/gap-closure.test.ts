import { describe, expect, it } from 'vitest'
import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAdmin, setup, toCustomerReview, validInquiry } from '../helpers/app'
import { EXE, MP4, PNG } from '../helpers/store'
import { hashPassword } from '../../server/lib/crypto'
import { redact } from '../../server/lib/log'

describe('A1 — environment isolation guard', () => {
  it('refuses all API access when no database is bound (isolated preview)', async () => {
    const ctx = await setup({ noDb: true, appEnv: 'preview' })
    const r = await ctx.call('GET', '/health')
    expect(r.status).toBe(503)
    expect(r.body.error.code).toBe('DATABASE_UNAVAILABLE')
  })
  it('blocks a preview deployment bound to the production database (marker mismatch)', async () => {
    const ctx = await setup({ appEnv: 'preview', marker: 'production' })
    for (const [m, p, json] of [['GET', '/health'], ['POST', '/inquiries', validInquiry()], ['POST', '/admin/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }]] as const) {
      const r = await ctx.call(m, p, { json })
      expect(r.status, `${m} ${p}`).toBe(503)
      expect(r.body.error.code).toBe('ENV_MISMATCH')
    }
    expect((ctx.raw.prepare('SELECT COUNT(*) n FROM projects').get() as { n: number }).n).toBe(0)
  })
  it('blocks an unstamped database and an unknown APP_ENV', async () => {
    expect((await (await setup({ marker: null })).call('GET', '/health')).body.error.code).toBe('ENV_MISMATCH')
    expect((await (await setup({ appEnv: 'staging-x' })).call('GET', '/health')).body.error.code).toBe('ENV_NOT_CONFIGURED')
    expect((await (await setup({ appEnv: '' })).call('GET', '/health')).body.error.code).toBe('ENV_NOT_CONFIGURED')
  })
  it('allows a matching marker', async () => {
    const ctx = await setup({ appEnv: 'production', marker: 'production' })
    expect((await ctx.call('GET', '/health')).status).toBe(200)
  })
})

describe('A2 — final approval invariant', () => {
  it('approval is disabled (fail closed) when private delivery is not configured', async () => {
    const ctx = await setup() // no DELIVERY_BUCKET binding = current production state
    const { auth } = await loginAdmin(ctx.call)
    const { id, reference, token } = await toCustomerReview(ctx, auth)
    const view = await ctx.call('GET', `/projects/${reference}`, { headers: { 'x-project-token': token } })
    expect(view.body.data.actions.canApprove).toBe(false)
    expect(view.body.data.deliveryEnabled).toBe(false)
    const r = await ctx.call('POST', `/projects/${reference}/approval`, { json: { assetId: crypto.randomUUID() }, headers: { 'x-project-token': token } })
    expect(r.status).toBe(409)
    expect(r.body.error.code).toBe('DELIVERY_UNAVAILABLE')
    // Staff cannot bypass it either.
    const s = await ctx.call('PATCH', `/admin/projects/${id}/status`, { json: { toStatus: 'approved', reason: 'via email' }, headers: auth })
    expect(s.status).toBe(409)
    expect((ctx.raw.prepare('SELECT status FROM projects WHERE id = ?').get(id) as { status: string }).status).toBe('customer_review')
  })

  it('rejects: no asset, missing assetId, preview-only asset, wrong-project asset, revoked asset, missing object', async () => {
    const ctx = await setup({ assets: true })
    const { auth } = await loginAdmin(ctx.call)
    const A = await toCustomerReview(ctx, auth)
    const B = await toCustomerReview(ctx, auth, { title: 'Proyek B' })
    const h = { 'x-project-token': A.token }
    const approve = (assetId?: string) => ctx.call('POST', `/projects/${A.reference}/approval`, { json: assetId ? { assetId } : {}, headers: h })

    // no asset at all
    expect((await ctx.call('GET', `/projects/${A.reference}`, { headers: h })).body.data.actions.canApprove).toBe(false)
    expect((await approve(crypto.randomUUID())).body.error.code).toBe('FINAL_ASSET_INVALID')
    expect((await approve()).status).toBe(422)

    // preview (non-final) asset
    const prev = await ctx.upload(A.id, 'preview', PNG, auth)
    expect(prev.status).toBe(201)
    expect((await approve(prev.body.data.id)).body.error.code).toBe('FINAL_ASSET_INVALID')

    // final asset of ANOTHER project
    const finalB = await ctx.upload(B.id, 'final', PNG, auth)
    expect((await approve(finalB.body.data.id)).body.error.code).toBe('FINAL_ASSET_INVALID')

    // revoked final asset
    const f1 = await ctx.upload(A.id, 'final', PNG, auth)
    expect((await ctx.call('POST', `/admin/projects/${A.id}/assets/${f1.body.data.id}/revoke`, { json: { note: 'salah versi' }, headers: auth })).status).toBe(200)
    expect((await approve(f1.body.data.id)).body.error.code).toBe('FINAL_ASSET_INVALID')

    // metadata present but object missing in private storage
    const f2 = await ctx.upload(A.id, 'final', PNG, auth)
    const key = (ctx.raw.prepare('SELECT storage_key FROM assets WHERE id = ?').get(f2.body.data.id) as { storage_key: string }).storage_key
    ctx.objects.delete(key)
    expect((await approve(f2.body.data.id)).body.error.code).toBe('FINAL_ASSET_MISSING')

    expect((ctx.raw.prepare('SELECT status FROM projects WHERE id = ?').get(A.id) as { status: string }).status).toBe('customer_review')
  })

  it('accepts a valid final asset, records which one, and rejects repeat approval', async () => {
    const ctx = await setup({ assets: true })
    const { auth } = await loginAdmin(ctx.call)
    const A = await toCustomerReview(ctx, auth)
    const h = { 'x-project-token': A.token }
    const f = await ctx.upload(A.id, 'final', MP4, auth, 'teaser final.mp4')
    expect(f.body.data).toMatchObject({ kind: 'final', mimeType: 'video/mp4', filename: 'teaser final.mp4', version: 1 })
    expect((await ctx.call('GET', `/projects/${A.reference}`, { headers: h })).body.data.actions.canApprove).toBe(true)
    const ok = await ctx.call('POST', `/projects/${A.reference}/approval`, { json: { assetId: f.body.data.id }, headers: h })
    expect(ok.status).toBe(200)
    const row = ctx.raw.prepare('SELECT status, approved_asset_id FROM projects WHERE id = ?').get(A.id) as { status: string; approved_asset_id: string }
    expect(row).toEqual({ status: 'approved', approved_asset_id: f.body.data.id })
    const ev = ctx.raw.prepare(`SELECT actor_type, safe_metadata_json FROM project_events WHERE project_id = ? AND to_status = 'approved'`).get(A.id) as { actor_type: string; safe_metadata_json: string }
    expect(ev.actor_type).toBe('customer')
    expect(JSON.parse(ev.safe_metadata_json).assetId).toBe(f.body.data.id)
    const again = await ctx.call('POST', `/projects/${A.reference}/approval`, { json: { assetId: f.body.data.id }, headers: h })
    expect(again.status).toBe(409)
    expect((ctx.raw.prepare(`SELECT COUNT(*) n FROM project_events WHERE project_id = ? AND to_status = 'approved'`).get(A.id) as { n: number }).n).toBe(1)
  })

  it('revoked customer link cannot approve even with a valid final asset', async () => {
    const ctx = await setup({ assets: true })
    const { auth } = await loginAdmin(ctx.call)
    const A = await toCustomerReview(ctx, auth)
    const f = await ctx.upload(A.id, 'final', PNG, auth)
    await ctx.call('POST', `/admin/projects/${A.id}/access-link?revokePrevious=true`, { json: {}, headers: auth })
    const r = await ctx.call('POST', `/projects/${A.reference}/approval`, { json: { assetId: f.body.data.id }, headers: { 'x-project-token': A.token } })
    expect(r.status).toBe(404)
  })

  it('staff-recorded approval needs reason + valid final asset; delivered needs the approved asset to still exist', async () => {
    const ctx = await setup({ assets: true })
    const { auth } = await loginAdmin(ctx.call)
    const A = await toCustomerReview(ctx, auth)
    const f = await ctx.upload(A.id, 'final', PNG, auth)
    const patch = (json: unknown) => ctx.call('PATCH', `/admin/projects/${A.id}/status`, { json, headers: auth })
    expect((await patch({ toStatus: 'approved', reason: 'Persetujuan via email 1 Nov' })).body.error.code).toBe('FINAL_ASSET_REQUIRED')
    expect((await patch({ toStatus: 'approved', assetId: f.body.data.id })).body.error.code).toBe('REASON_REQUIRED')
    expect((await patch({ toStatus: 'approved', reason: 'Persetujuan via email 1 Nov', assetId: f.body.data.id })).status).toBe(200)
    // Approved file disappears from storage → cannot be marked delivered.
    const key = (ctx.raw.prepare('SELECT storage_key FROM assets WHERE id = ?').get(f.body.data.id) as { storage_key: string }).storage_key
    ctx.objects.delete(key)
    expect((await patch({ toStatus: 'delivered' })).body.error.code).toBe('FINAL_ASSET_MISSING')
  })
})

describe('A3 — private file delivery', () => {
  it('is disabled cleanly without a bucket', async () => {
    const ctx = await setup()
    const { auth } = await loginAdmin(ctx.call)
    const A = await toCustomerReview(ctx, auth)
    const up = await ctx.upload(A.id, 'final', PNG, auth)
    expect(up.status).toBe(503)
    expect(up.body.error.code).toBe('DELIVERY_DISABLED')
  })
  it('validates file signature, size, kind and project state; never exposes storage keys', async () => {
    const ctx = await setup({ assets: true })
    const { auth } = await loginAdmin(ctx.call)
    const A = await toCustomerReview(ctx, auth)
    expect((await ctx.upload(A.id, 'final', EXE, auth, 'tool.png')).status).toBe(415)
    expect((await ctx.upload(A.id, 'source', PNG, auth)).status).toBe(422)
    expect((await ctx.upload(A.id, 'final', new Uint8Array(0), auth)).status).toBeGreaterThanOrEqual(400)
    const big = new Uint8Array(25 * 1024 * 1024 + 1); big.set(PNG)
    expect((await ctx.upload(A.id, 'final', big, auth)).status).toBe(413)
    const ok = await ctx.upload(A.id, 'preview', PNG, auth, '../../etc/passwd.png')
    expect(ok.status).toBe(201)
    expect(ok.body.data.filename).not.toContain('/')
    expect(JSON.stringify(ok.body)).not.toContain('projects/')
    const detail = await ctx.call('GET', `/admin/projects/${A.id}`, { headers: auth })
    expect(JSON.stringify(detail.body)).not.toContain('storage_key')
    // upload in an early state is refused
    const r = await ctx.call('POST', '/inquiries', { json: validInquiry() })
    const early = ctx.raw.prepare('SELECT id FROM projects WHERE public_reference = ?').get(r.body.data.reference) as { id: string }
    expect((await ctx.upload(early.id, 'final', PNG, auth)).status).toBe(409)
  })
  it('customer can download own assets with token header; other project / no token / revoked asset are denied', async () => {
    const ctx = await setup({ assets: true })
    const { auth } = await loginAdmin(ctx.call)
    const A = await toCustomerReview(ctx, auth)
    const B = await toCustomerReview(ctx, auth, { title: 'Proyek B' })
    const fa = await ctx.upload(A.id, 'final', PNG, auth)
    const fb = await ctx.upload(B.id, 'final', PNG, auth)
    const dl = (ref: string, assetId: string, token?: string) => ctx.call('GET', `/projects/${ref}/assets/${assetId}/download`, { headers: token ? { 'x-project-token': token } : {} })
    const good = await dl(A.reference, fa.body.data.id, A.token)
    expect(good.status).toBe(200)
    expect(Array.from(good.bytes!)).toEqual(Array.from(PNG))
    expect(good.headers.get('cache-control')).toBe('private, no-store')
    expect(good.headers.get('content-disposition')).toMatch(/^attachment;/)
    expect((await dl(A.reference, fa.body.data.id)).status).toBe(404)
    expect((await dl(A.reference, fb.body.data.id, A.token)).status).toBe(404) // B's asset via A's project
    expect((await dl(B.reference, fb.body.data.id, A.token)).status).toBe(404) // A's token on B
    await ctx.call('POST', `/admin/projects/${A.id}/assets/${fa.body.data.id}/revoke`, { json: { note: 'ditarik' }, headers: auth })
    expect((await dl(A.reference, fa.body.data.id, A.token)).status).toBe(404)
    const evs = ctx.raw.prepare(`SELECT event_type FROM project_events WHERE project_id = ?`).all(A.id) as { event_type: string }[]
    expect(evs.map((e) => e.event_type)).toEqual(expect.arrayContaining(['asset_uploaded', 'asset_downloaded', 'asset_revoked']))
  })
  it('assets are hidden from customers before the review stage', async () => {
    const ctx = await setup({ assets: true })
    const { auth } = await loginAdmin(ctx.call)
    const A = await toCustomerReview(ctx, auth)
    const f = await ctx.upload(A.id, 'final', PNG, auth)
    await ctx.call('POST', `/projects/${A.reference}/feedback`, { json: { message: 'Mohon revisi warna.' }, headers: { 'x-project-token': A.token } })
    await A.patch('producing')
    const v = await ctx.call('GET', `/projects/${A.reference}`, { headers: { 'x-project-token': A.token } })
    expect(v.body.data.assets).toEqual([])
    expect((await ctx.call('GET', `/projects/${A.reference}/assets/${f.body.data.id}/download`, { headers: { 'x-project-token': A.token } })).status).toBe(404)
  })
})

describe('B1 — authentication hardening', () => {
  it('ignores spoofed X-Forwarded-For when rate limiting login', async () => {
    const ctx = await setup()
    const statuses: number[] = []
    for (let i = 0; i < 12; i++) {
      statuses.push((await ctx.call('POST', '/admin/auth/login', { json: { email: ADMIN_EMAIL, password: 'wrong' }, ip: '198.51.100.7', headers: { 'x-forwarded-for': `1.2.3.${i}` } })).status)
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true)
    expect(statuses.slice(10)).toEqual([429, 429])
  })
  it('throttles per account across many IPs', async () => {
    const ctx = await setup()
    const statuses: number[] = []
    for (let i = 0; i < 22; i++) statuses.push((await ctx.call('POST', '/admin/auth/login', { json: { email: ADMIN_EMAIL, password: 'wrong' } })).status)
    expect(statuses.slice(0, 20).every((s) => s === 401)).toBe(true)
    expect(statuses.slice(20)).toEqual([429, 429])
  })
  it('malformed and replayed-after-logout cookies are rejected', async () => {
    const ctx = await setup()
    for (const cookie of ['avl_session=', 'avl_session=../../x', `avl_session=${'a'.repeat(500)}`, 'avl_session=%00%00']) {
      expect((await ctx.call('GET', '/admin/projects', { headers: { cookie } })).status).toBe(401)
    }
    const { auth } = await loginAdmin(ctx.call)
    await ctx.call('POST', '/admin/auth/logout', { json: {}, headers: auth })
    expect((await ctx.call('GET', '/admin/projects', { headers: auth })).status).toBe(401)
  })
  it('logout-all revokes every session', async () => {
    const ctx = await setup()
    const s1 = await loginAdmin(ctx.call)
    const s2 = await loginAdmin(ctx.call)
    expect((await ctx.call('POST', '/admin/auth/logout-all', { json: {}, headers: s1.auth })).status).toBe(200)
    expect((await ctx.call('GET', '/admin/projects', { headers: s2.auth })).status).toBe(401)
    expect((ctx.raw.prepare('SELECT COUNT(*) n FROM sessions').get() as { n: number }).n).toBe(0)
  })
  it('rotating the admin password hash invalidates existing sessions', async () => {
    const ctx = await setup()
    const { auth } = await loginAdmin(ctx.call)
    expect((await ctx.call('GET', '/admin/projects', { headers: auth })).status).toBe(200)
    ctx.env.ADMIN_PASSWORD_HASH = await hashPassword('a-brand-new-passphrase', 10_000)
    expect((await ctx.call('GET', '/admin/projects', { headers: auth })).status).toBe(401)
  })
  it('non-admin roles are not functional (single-admin mode)', async () => {
    const ctx = await setup()
    const { auth } = await loginAdmin(ctx.call)
    ctx.raw.prepare(`UPDATE users SET role = 'producer'`).run()
    expect((await ctx.call('GET', '/admin/projects', { headers: auth })).status).toBe(401)
  })
  it('cross-site fetch metadata is rejected for state changes', async () => {
    const ctx = await setup()
    const { auth } = await loginAdmin(ctx.call)
    const r = await ctx.call('POST', '/admin/auth/logout', { json: {}, headers: { ...auth, 'sec-fetch-site': 'cross-site' } })
    expect(r.status).toBe(403)
  })
})

describe('B2/B3 — link expiry, redaction, exports, retention', () => {
  it('expired customer token is rejected', async () => {
    const ctx = await setup()
    const { signProjectToken } = await import('../../server/lib/projectToken')
    const r = await ctx.call('POST', '/inquiries', { json: validInquiry() })
    const p = ctx.raw.prepare('SELECT id, public_reference FROM projects').get() as { id: string; public_reference: string }
    void r
    const { token } = await signProjectToken(ctx.env.LINK_SIGNING_SECRET!, p.id, 1, 60, Math.floor(Date.now() / 1000) - 3600)
    expect((await ctx.call('GET', `/projects/${p.public_reference}`, { headers: { 'x-project-token': token } })).status).toBe(404)
  })
  it('redact() strips emails, phones, tokens, hashes and signed query params', () => {
    const out = redact('mail a.b@example.test wa +62 812 3456 7890 link https://x.test/p/AVL-AAAA-BBBB#t=abc.def hash pbkdf2$100000$c2FsdA$aGFzaA url?sig=SECRET&x=1')
    expect(out).not.toMatch(/example\.test|3456|abc\.def|aGFzaA|SECRET/)
  })
  it('export is authenticated, audited, bounded and free of storage keys/token versions', async () => {
    const ctx = await setup({ assets: true })
    expect((await ctx.call('GET', `/admin/projects/${crypto.randomUUID()}/export`)).status).toBe(401)
    const { auth } = await loginAdmin(ctx.call)
    const A = await toCustomerReview(ctx, auth)
    await ctx.upload(A.id, 'final', PNG, auth)
    const e = await ctx.call('GET', `/admin/projects/${A.id}/export`, { headers: auth })
    expect(e.status).toBe(200)
    const text = JSON.stringify(e.body)
    expect(text).not.toContain('storage_key')
    expect(text).not.toContain('access_token_version')
    expect(e.body.data.limitPerSection).toBe(5000)
    expect((ctx.raw.prepare(`SELECT COUNT(*) n FROM project_events WHERE project_id = ? AND event_type = 'project_exported'`).get(A.id) as { n: number }).n).toBe(1)
  })
  it('prunes stale rate-limit rows and idempotency keys', async () => {
    const ctx = await setup()
    ctx.raw.prepare(`INSERT INTO rate_limits (bucket_key, window_start, count) VALUES ('old', 1, 1)`).run()
    await ctx.call('POST', '/inquiries', { json: validInquiry() })
    expect((ctx.raw.prepare(`SELECT COUNT(*) n FROM rate_limits WHERE bucket_key = 'old'`).get() as { n: number }).n).toBe(0)
  })
})

describe('D4 — cost ledger', () => {
  it('records costs and computes gross contribution from confirmed payments', async () => {
    const ctx = await setup()
    const { auth } = await loginAdmin(ctx.call)
    const A = await toCustomerReview(ctx, auth)
    expect((await ctx.call('POST', `/admin/projects/${A.id}/costs`, { json: { kind: 'tool', amountMinor: 150000 }, headers: auth })).status).toBe(201)
    expect((await ctx.call('POST', `/admin/projects/${A.id}/costs`, { json: { kind: 'labor', minutes: 240, amountMinor: 200000 }, headers: auth })).status).toBe(201)
    expect((await ctx.call('POST', `/admin/projects/${A.id}/costs`, { json: { kind: 'tool' }, headers: auth })).status).toBe(422)
    const d = await ctx.call('GET', `/admin/projects/${A.id}`, { headers: auth })
    expect(d.body.data.economics).toMatchObject({ revenueConfirmed: 1000000, directCost: 150000, laborCost: 200000, laborMinutes: 240, grossContribution: 650000 })
  })
})

describe('A3 — binding safety', () => {
  it('a non-R2 binding (e.g. the Pages static-asset Fetcher) never enables delivery or approval', async () => {
    const ctx = await setup()
    ;(ctx.env as unknown as Record<string, unknown>).DELIVERY_BUCKET = { fetch: async () => new Response('x') }
    ;(ctx.env as unknown as Record<string, unknown>).ASSETS = { fetch: async () => new Response('x') }
    const { auth } = await loginAdmin(ctx.call)
    const A = await toCustomerReview(ctx, auth)
    expect((await ctx.upload(A.id, 'final', PNG, auth)).body.error.code).toBe('DELIVERY_DISABLED')
    const v = await ctx.call('GET', `/projects/${A.reference}`, { headers: { 'x-project-token': A.token } })
    expect(v.body.data.deliveryEnabled).toBe(false)
    expect(v.body.data.actions.canApprove).toBe(false)
  })
})
