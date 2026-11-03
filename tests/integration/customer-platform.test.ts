import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLERK_TEST, CLERK_TEST_PK, loginAdmin, payBalance, setup, toCustomerReview, validInquiry } from '../helpers/app'
import { resetJwksCache } from '../../server/lib/clerk'
import { splitAmount } from '../../server/domain/schedule'

type Ctx = Awaited<ReturnType<typeof setup>>
const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
let keys: CryptoKeyPair
let otherKeys: CryptoKeyPair
let jwk: JsonWebKey
const KID = 'ins_test_kid'

beforeAll(async () => {
  const alg = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }
  keys = (await crypto.subtle.generateKey(alg, true, ['sign', 'verify'])) as CryptoKeyPair
  otherKeys = (await crypto.subtle.generateKey(alg, true, ['sign', 'verify'])) as CryptoKeyPair
  jwk = (await crypto.subtle.exportKey('jwk', keys.publicKey)) as JsonWebKey
})

async function token(claims: Record<string, unknown> = {}, o: { key?: CryptoKey; kid?: string; alg?: string } = {}) {
  const now = Math.floor(Date.now() / 1000)
  const header = enc({ alg: o.alg ?? 'RS256', kid: o.kid ?? KID, typ: 'JWT' })
  const payload = enc({ iss: `https://${CLERK_TEST.host}`, sub: 'user_alice123456', azp: CLERK_TEST.origin, sid: 'sess_1', iat: now, nbf: now - 1, exp: now + 60, ...claims })
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', o.key ?? keys.privateKey, new TextEncoder().encode(`${header}.${payload}`))
  return `${header}.${payload}.${Buffer.from(sig).toString('base64url')}`
}
const bearer = (t: string) => ({ authorization: `Bearer ${t}` })

let ctx: Ctx
let jwksCalls = 0
beforeEach(async () => {
  resetJwksCache()
  jwksCalls = 0
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === `https://${CLERK_TEST.host}/.well-known/jwks.json`) { jwksCalls++; return Response.json({ keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] }) }
    return new Response('unexpected', { status: 500 })
  }))
  ctx = await setup({ clerk: true, assets: true })
})
afterEach(() => vi.unstubAllGlobals())

describe('Clerk customer authentication (Development instance semantics)', () => {
  it('publishes only the publishable key; disabled when not configured; dev key refused in production', async () => {
    const r = await ctx.call('GET', '/account/config')
    expect(r.body.data).toMatchObject({ clerkPublishableKey: CLERK_TEST_PK, clerkInstance: 'development', briefRequiresAccount: false })
    expect(JSON.stringify(r.body)).not.toMatch(/sk_(test|live)/)
    const off = await setup()
    expect((await off.call('GET', '/account/config')).body.data.clerkPublishableKey).toBeNull()
    expect((await off.call('GET', '/account/me', { headers: bearer(await token()) })).status).toBe(503)
    const prod = await setup({ clerk: true, appEnv: 'production', marker: 'production' })
    expect((await prod.call('GET', '/account/config')).body.data.clerkPublishableKey).toBeNull()
  })

  it('accepts a valid token and maps the immutable subject to one internal customer', async () => {
    const t = await token()
    const a = await ctx.call('GET', '/account/me', { headers: bearer(t) })
    expect(a.status).toBe(200)
    const b = await ctx.call('GET', '/account/me', { headers: bearer(await token()) })
    expect(b.body.data.id).toBe(a.body.data.id)
    expect((ctx.raw.prepare('SELECT COUNT(*) n FROM customers').get() as { n: number }).n).toBe(1)
    expect(jwksCalls).toBe(1) // cached
  })

  it('rejects missing, malformed, tampered, wrong-key, wrong-alg, expired, not-yet-valid, wrong issuer, wrong azp, missing azp, bad sub, pending', async () => {
    const now = Math.floor(Date.now() / 1000)
    const good = await token()
    const [h, p] = good.split('.')
    const tampered = `${h}.${enc({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), sub: 'user_mallory12345' })}.${good.split('.')[2]}`
    const cases: [string, string | null][] = [
      ['missing', null],
      ['malformed', 'not.a.jwt!'],
      ['tampered', tampered],
      ['wrong key', await token({}, { key: otherKeys.privateKey })],
      ['unknown kid', await token({}, { kid: 'other' })],
      ['alg', await token({}, { alg: 'HS256' })],
      ['expired', await token({ exp: now - 60 })],
      ['nbf', await token({ nbf: now + 600 })],
      ['issuer', await token({ iss: 'https://evil.clerk.accounts.dev' })],
      ['azp', await token({ azp: 'https://evil.example' })],
      ['no azp', await token({ azp: undefined })],
      ['sub', await token({ sub: 'admin' })],
      ['pending', await token({ sts: 'pending' })],
    ]
    for (const [name, t] of cases) {
      const r = await ctx.call('GET', '/account/me', { headers: t ? bearer(t) : {} })
      expect(r.status, name).toBe(401)
    }
    expect((ctx.raw.prepare('SELECT COUNT(*) n FROM customers').get() as { n: number }).n).toBe(0)
  })

  it('a customer token never grants admin access', async () => {
    const t = await token()
    for (const path of ['/admin/projects', '/admin/dashboard', '/admin/customers', '/admin/catalog', '/admin/auth/me']) {
      expect((await ctx.call('GET', path, { headers: bearer(t) })).status, path).toBe(401)
    }
  })

  it('onboarding is optional; drafts are per customer and bounded', async () => {
    const a = bearer(await token())
    const b = bearer(await token({ sub: 'user_bob999999' }))
    expect((await ctx.call('POST', '/account/me/onboarding', { json: { action: 'skip' }, headers: a })).status).toBe(200)
    expect((await ctx.call('GET', '/account/me', { headers: a })).body.data.onboarding).toEqual({ completed: false, skipped: true })
    expect((await ctx.call('PUT', '/account/me/draft', { json: { data: { title: 'Rahasia A' } }, headers: a })).status).toBe(200)
    expect((await ctx.call('GET', '/account/me/draft', { headers: b })).body.data).toBeNull()
    expect((await ctx.call('GET', '/account/me/draft', { headers: a })).body.data.data).toEqual({ title: 'Rahasia A' })
    expect((await ctx.call('PUT', '/account/me/draft', { json: { data: { 'bad key!': 'x' } }, headers: a })).status).toBe(422)
  })
})

describe('guest brief → account binding + customer isolation', () => {
  it('signed-in brief binds to the verified customer, clears the draft and records the offer version', async () => {
    const a = bearer(await token())
    await ctx.call('PUT', '/account/me/draft', { json: { data: { title: 'x' } }, headers: a })
    const r = await ctx.call('POST', '/inquiries', { json: validInquiry({ offerSlug: 'ai-image-production' }), headers: a })
    expect(r.status).toBe(201)
    const row = ctx.raw.prepare('SELECT customer_id, offer_version_id FROM projects WHERE public_reference = ?').get(r.body.data.reference) as { customer_id: string; offer_version_id: string }
    const me = await ctx.call('GET', '/account/me', { headers: a })
    expect(row).toEqual({ customer_id: me.body.data.id, offer_version_id: 'ov-ai-image-1' })
    expect((await ctx.call('GET', '/account/me/draft', { headers: a })).body.data).toBeNull()
    const list = await ctx.call('GET', '/account/me/projects', { headers: a })
    expect(list.body.data.projects).toHaveLength(1)
    expect(list.body.data.projects[0]).toMatchObject({ reference: r.body.data.reference, offerName: 'AI Image Production' })
  })

  it('unavailable offers are rejected; guest briefs still work unless the account requirement is on', async () => {
    expect((await ctx.call('POST', '/inquiries', { json: validInquiry({ offerSlug: 'does-not-exist' }) })).body.error.code).toBe('OFFER_UNAVAILABLE')
    expect((await ctx.call('POST', '/inquiries', { json: validInquiry() })).status).toBe(201)
    const strict = await setup({ clerk: true, briefRequiresAccount: true })
    expect((await strict.call('POST', '/inquiries', { json: validInquiry() })).body.error.code).toBe('ACCOUNT_REQUIRED')
    expect((await strict.call('GET', '/account/config')).body.data.briefRequiresAccount).toBe(true)
  })

  it('customer A cannot read, act on or download customer B’s project; legacy projects are never claimed by email', async () => {
    const a = bearer(await token())
    const b = bearer(await token({ sub: 'user_bob999999' }))
    const ra = await ctx.call('POST', '/inquiries', { json: validInquiry({ title: 'Proyek milik A' }), headers: a })
    const ref = ra.body.data.reference
    expect((await ctx.call('GET', `/projects/${ref}`, { headers: a })).status).toBe(200)
    for (const [m, path, json] of [
      ['GET', `/projects/${ref}`, undefined], ['POST', `/projects/${ref}/support`, { category: 'issue', message: 'ingin lihat' }],
      ['POST', `/projects/${ref}/quote/decision`, { decision: 'accepted' }], ['POST', `/projects/${ref}/feedback`, { message: 'mengintip proyek' }],
    ] as const) {
      expect((await ctx.call(m, path, { json, headers: b })).status, `${m} ${path}`).toBe(404)
    }
    // Guest (legacy) project with the same email is not visible to any account.
    const guest = await ctx.call('POST', '/inquiries', { json: validInquiry() })
    expect((await ctx.call('GET', `/projects/${guest.body.data.reference}`, { headers: a })).status).toBe(404)
    expect((await ctx.call('GET', '/account/me/projects', { headers: b })).body.data.projects).toHaveLength(0)
  })

  it('legacy signed project link keeps working alongside accounts', async () => {
    const { auth } = await loginAdmin(ctx.call)
    const P = await toCustomerReview(ctx, auth)
    expect((await ctx.call('GET', `/projects/${P.reference}`, { headers: { 'x-project-token': P.token } })).status).toBe(200)
  })
})

describe('50% deposit + 50% balance schedule', () => {
  it('splits in integer IDR, deposit rounded up', () => {
    expect(splitAmount(1_000_001)).toEqual([{ kind: 'deposit', sequence: 1, amount: 500_001 }, { kind: 'balance', sequence: 2, amount: 500_000 }])
    expect(splitAmount(1)).toEqual([{ kind: 'full', sequence: 1, amount: 1 }])
    expect(splitAmount(0)).toEqual([])
  })

  it('acceptance creates milestones; deposit gates production; manual amount must equal the next milestone; balance gates delivery + final download', async () => {
    const { auth } = await loginAdmin(ctx.call)
    const P = await toCustomerReview(ctx, auth) // quote 1,000,000; deposit 500,000 confirmed inside the helper
    const view = await ctx.call('GET', `/projects/${P.reference}`, { headers: { 'x-project-token': P.token } })
    expect(view.body.data.payment.schedule).toMatchObject({ totalMinor: 1000000, paidMinor: 500000, remainingMinor: 500000, status: 'partially_paid' })
    expect(view.body.data.payment.schedule.milestones.map((m: { kind: string; status: string }) => `${m.kind}:${m.status}`)).toEqual(['deposit:paid', 'balance:unpaid'])
    // Wrong amount for balance is refused (no silent partial/combined settlement).
    expect((await ctx.call('POST', `/admin/projects/${P.id}/payments/confirm`, { json: { amountMinor: 1000000, method: 'Transfer' }, headers: auth })).body.error.code).toBe('AMOUNT_MISMATCH')
    await payBalance(ctx, auth, P.id)
    expect((await ctx.call('POST', `/admin/projects/${P.id}/payments/confirm`, { json: { amountMinor: 500000, method: 'Transfer' }, headers: auth })).body.error.code).toBe('ALREADY_PAID')
    const after = await ctx.call('GET', `/admin/projects/${P.id}`, { headers: auth })
    expect(after.body.data.schedule).toMatchObject({ paidMinor: 1000000, remainingMinor: 0, status: 'paid' })
  })

  it('production cannot start without the deposit (unless an audited exception reason is given)', async () => {
    const { auth } = await loginAdmin(ctx.call)
    const r = await ctx.call('POST', '/inquiries', { json: validInquiry() })
    const { id } = ctx.raw.prepare('SELECT id FROM projects WHERE public_reference = ?').get(r.body.data.reference) as { id: string }
    const patch = (json: unknown) => ctx.call('PATCH', `/admin/projects/${id}/status`, { json, headers: auth })
    await patch({ toStatus: 'qualifying' })
    await ctx.call('POST', `/admin/projects/${id}/quotes`, { json: { amountMinor: 800000, deliverables: ['Satu gambar 1:1'], includedRevisionRounds: 1, status: 'sent' }, headers: auth })
    await patch({ toStatus: 'quoted' })
    expect((await patch({ toStatus: 'queued' })).body.error.code).toBe('PAYMENT_REQUIRED')
    expect((await patch({ toStatus: 'queued', reason: 'Pengecualian tertulis pemilik' })).status).toBe(200)
  })
})

describe('action runs (human-operated, customer authorization)', () => {
  it('requires a paid project; staff cannot self-authorize; customer authorization queues; customer sees public steps only', async () => {
    const { auth } = await loginAdmin(ctx.call)
    const early = await ctx.call('POST', '/inquiries', { json: validInquiry() })
    const { id: earlyId } = ctx.raw.prepare('SELECT id FROM projects WHERE public_reference = ?').get(early.body.data.reference) as { id: string }
    const body = { title: 'Repurpose 6 aset', objective: 'Adaptasi key visual ke 6 format kanal', allowedOperations: 'Siapkan file; tanpa posting ke akun klien', externalSideEffect: false }
    expect((await ctx.call('POST', `/admin/projects/${earlyId}/actions`, { json: body, headers: auth })).body.error.code).toBe('PROJECT_NOT_ELIGIBLE')
    const P = await toCustomerReview(ctx, auth)
    const run = await ctx.call('POST', `/admin/projects/${P.id}/actions`, { json: body, headers: auth })
    expect(run.status).toBe(201)
    const tr = (to: string, extra: Record<string, unknown> = {}) => ctx.call('POST', `/admin/projects/${P.id}/actions/${run.body.data.id}/transition`, { json: { to, ...extra }, headers: auth })
    expect((await tr('queued')).body.error.code).toBe('AUTHORIZATION_REQUIRED')
    expect((await tr('awaiting_authorization', { note: 'Mohon setujui', visibility: 'public' })).status).toBe(200)
    expect((await tr('queued')).body.error.code).toBe('INVALID_RUN_TRANSITION')
    const h = { 'x-project-token': P.token }
    expect((await ctx.call('POST', `/projects/${P.reference}/actions/${run.body.data.id}/authorize`, { json: { confirm: true }, headers: h })).status).toBe(200)
    expect((await ctx.call('POST', `/projects/${P.reference}/actions/${run.body.data.id}/authorize`, { json: { confirm: true }, headers: h })).body.error.code).toBe('NOT_AWAITING_AUTHORIZATION')
    expect((await tr('manual_in_progress', { note: 'catatan internal rahasia' })).status).toBe(200)
    expect((await tr('failed')).body.error.code).toBe('ERROR_CODE_REQUIRED')
    expect((await tr('review')).status).toBe(200)
    expect((await tr('completed')).body.error.code).toBe('RESULT_REQUIRED')
    expect((await tr('completed', { resultSummary: '6 file diserahkan', visibility: 'public' })).status).toBe(200)
    const view = await ctx.call('GET', `/projects/${P.reference}`, { headers: h })
    const r = view.body.data.actionRuns[0]
    expect(r).toMatchObject({ status: 'completed', resultSummary: '6 file diserahkan' })
    expect(JSON.stringify(view.body.data.actionRuns)).not.toContain('catatan internal rahasia')
    // Another project's link cannot authorize this run.
    const Q = await toCustomerReview(ctx, auth, { title: 'Proyek lain' })
    expect((await ctx.call('POST', `/projects/${Q.reference}/actions/${run.body.data.id}/authorize`, { json: { confirm: true }, headers: { 'x-project-token': Q.token } })).status).toBe(404)
  })
})

describe('catalog + CRM', () => {
  it('public catalog lists only published items with truthful quote_required pricing; detail and filters work', async () => {
    const c = await ctx.call('GET', '/catalog')
    expect(c.body.data.items.map((i: { slug: string }) => i.slug)).toEqual(['ai-image-production', 'ai-video-production', 'content-repurposing-pack', 'custom-project'])
    expect(c.body.data.items.every((i: { offer: { priceMode: string; priceMinor: null } }) => i.offer.priceMode === 'quote_required' && i.offer.priceMinor === null)).toBe(true)
    expect((await ctx.call('GET', '/catalog?lane=action_services')).body.data.items).toHaveLength(1)
    expect((await ctx.call('GET', '/catalog?lane=creative_products')).body.data.items).toHaveLength(0)
    expect((await ctx.call('GET', '/catalog/ai-video-production')).body.data.offer.scope.length).toBeGreaterThan(0)
    expect((await ctx.call('GET', '/catalog/nope')).status).toBe(404)
  })

  it('offer versions are immutable; fixed prices need unit-economics evidence; existing projects keep their version', async () => {
    const { auth } = await loginAdmin(ctx.call)
    const base = { deliverables: ['5 gambar'], scope: ['Format 4:5'], inputs: ['Foto produk'], deliveryAssumption: 'Estimasi 5 hari kerja.', rightsSummary: 'Lisensi penggunaan sesuai penawaran.' }
    expect((await ctx.call('POST', '/admin/catalog/offers/offer-ai-image/versions', { json: { ...base, priceMode: 'fixed', priceMinor: 900000 }, headers: auth })).status).toBe(422)
    expect((await ctx.call('POST', '/admin/catalog/offers/offer-ai-image/versions', { json: { ...base, priceMode: 'quote_required', priceMinor: 1 }, headers: auth })).status).toBe(422)
    const v2 = await ctx.call('POST', '/admin/catalog/offers/offer-ai-image/versions', { json: { ...base, priceMode: 'fixed', priceMinor: 900000, pricingEvidence: 'Biaya 4 jam kerja + kredit alat, margin 40%' }, headers: auth })
    expect(v2.body.data.version).toBe(2)
    const v1 = ctx.raw.prepare(`SELECT price_mode FROM offer_versions WHERE id = 'ov-ai-image-1'`).get() as { price_mode: string }
    expect(v1.price_mode).toBe('quote_required')
    expect((await ctx.call('GET', '/catalog/ai-image-production')).body.data.offer).toMatchObject({ version: 2, priceMode: 'fixed', priceMinor: 900000 })
    expect((await ctx.call('PATCH', '/admin/catalog/items/item-ai-video', { json: { itemStatus: 'archived' }, headers: auth })).status).toBe(200)
    expect((await ctx.call('GET', '/catalog/ai-video-production')).status).toBe(404)
    expect((ctx.raw.prepare(`SELECT COUNT(*) n FROM admin_audit`).get() as { n: number }).n).toBe(2)
    expect((await ctx.call('POST', '/admin/catalog/offers/offer-ai-image/versions', { json: base })).status).toBe(401)
  })

  it('CRM search is bounded and exact; customer 360 shows only that customer’s data; notes and tags are audited', async () => {
    const { auth } = await loginAdmin(ctx.call)
    const a = bearer(await token())
    const me = (await ctx.call('GET', '/account/me', { headers: a })).body.data
    const r = await ctx.call('POST', '/inquiries', { json: validInquiry(), headers: a })
    await ctx.call('GET', '/account/me', { headers: bearer(await token({ sub: 'user_bob999999' })) })
    expect((await ctx.call('GET', '/admin/customers', { headers: auth })).body.data.total).toBe(2)
    expect((await ctx.call('GET', `/admin/customers?q=${r.body.data.reference}`, { headers: auth })).body.data.items.map((x: { id: string }) => x.id)).toEqual([me.id])
    expect((await ctx.call('GET', `/admin/customers?q=${me.id}`, { headers: auth })).body.data.total).toBe(1)
    const d = await ctx.call('GET', `/admin/customers/${me.id}`, { headers: auth })
    expect(d.body.data.projects).toHaveLength(1)
    expect((await ctx.call('POST', `/admin/customers/${me.id}/notes`, { json: { note: 'Prefer WhatsApp' }, headers: auth })).status).toBe(201)
    expect((await ctx.call('PATCH', `/admin/customers/${me.id}/tags`, { json: { tags: ['vip', 'fnb'] }, headers: auth })).status).toBe(200)
    expect((await ctx.call('PATCH', `/admin/customers/${me.id}/tags`, { json: { tags: ['Bad Tag!'] }, headers: auth })).status).toBe(422)
    expect((await ctx.call('GET', `/admin/customers/${me.id}`, { headers: a })).status).toBe(401)
  })
})
