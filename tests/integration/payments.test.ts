import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { DUITKU_TEST, loginAdmin, setup, validInquiry } from '../helpers/app'

type Ctx = Awaited<ReturnType<typeof setup>>
const sign = (s: string) => createHmac('sha256', DUITKU_TEST.apiKey).update(s).digest('hex')

/** Fake Duitku: records requests, verifies our outbound signatures, answers per merchantOrderId state. */
function fakeDuitku() {
  const state = new Map<string, { status: '00' | '01' | '02'; amount: number }>()
  const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = []
  let invoiceFail = false
  const impl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const headers = Object.fromEntries(new Headers(init?.headers).entries())
    const body = JSON.parse(String(init?.body ?? '{}'))
    calls.push({ url, headers, body })
    if (url.includes('createInvoice')) {
      if (invoiceFail) return new Response('Merchant Not Found', { status: 400 })
      expect(headers['x-duitku-merchantcode']).toBe(DUITKU_TEST.merchantCode)
      expect(headers['x-duitku-signature']).toBe(sign(DUITKU_TEST.merchantCode + headers['x-duitku-timestamp']))
      state.set(body.merchantOrderId, { status: '01', amount: body.paymentAmount })
      return Response.json({ merchantCode: DUITKU_TEST.merchantCode, reference: `REF-${body.merchantOrderId}`, paymentUrl: 'https://app-sandbox.duitku.com/redirect_checkout?reference=x', statusCode: '00', statusMessage: 'SUCCESS' })
    }
    if (url.includes('transactionStatus')) {
      expect(body.signature).toBe(sign(DUITKU_TEST.merchantCode + body.merchantOrderId))
      const s = state.get(body.merchantOrderId)
      if (!s) return Response.json({ Message: 'Transaction not found' }, { status: 404 })
      return Response.json({ merchantOrderId: body.merchantOrderId, reference: `REF-${body.merchantOrderId}`, amount: String(s.amount), fee: '0.00', statusCode: s.status, statusMessage: 'x' })
    }
    if (url.includes('getpaymentmethod')) {
      return Response.json({ paymentFee: [{ paymentMethod: 'SP', paymentName: 'QRIS', totalFee: '0' }], responseCode: '00', responseMessage: 'SUCCESS' })
    }
    return new Response('unexpected', { status: 500 })
  }
  return { state, calls, impl, failInvoices: () => { invoiceFail = true } }
}

let ctx: Ctx
let fake: ReturnType<typeof fakeDuitku>
beforeEach(() => { fake = fakeDuitku(); vi.stubGlobal('fetch', vi.fn(fake.impl)) })
afterEach(() => vi.unstubAllGlobals())

/** Inquiry → quote sent → link → customer accepts. Project ends in "quoted" with an accepted quote. */
async function acceptedProject(c: Ctx, auth: Record<string, string>, amount = 1500000, overrides: Record<string, unknown> = {}) {
  const r = await c.call('POST', '/inquiries', { json: validInquiry(overrides) })
  const reference = r.body.data.reference as string
  const { id } = c.raw.prepare('SELECT id FROM projects WHERE public_reference = ?').get(reference) as { id: string }
  await c.call('PATCH', `/admin/projects/${id}/status`, { json: { toStatus: 'qualifying' }, headers: auth })
  await c.call('POST', `/admin/projects/${id}/quotes`, { json: { amountMinor: amount, deliverables: ['3 gambar 4:5'], includedRevisionRounds: 1, status: 'sent' }, headers: auth })
  await c.call('PATCH', `/admin/projects/${id}/status`, { json: { toStatus: 'quoted' }, headers: auth })
  const link = await c.call('POST', `/admin/projects/${id}/access-link`, { json: {}, headers: auth })
  const token = (link.body.data.url as string).split('#t=')[1]
  await c.call('POST', `/projects/${reference}/quote/decision`, { json: { decision: 'accepted' }, headers: { 'x-project-token': token } })
  return { id, reference, token, h: { 'x-project-token': token } }
}

function callbackFields(merchantOrderId: string, amount: number, resultCode = '00', overrideSig?: string) {
  return { merchantCode: DUITKU_TEST.merchantCode, amount: String(amount), merchantOrderId, resultCode, paymentCode: 'SP', reference: `REF-${merchantOrderId}`, signature: overrideSig ?? sign(DUITKU_TEST.merchantCode + amount + merchantOrderId) }
}

describe('Duitku POP — configuration gates', () => {
  it('checkout is refused when Duitku is not configured or the switch is off', async () => {
    for (const opts of [{}, { duitku: true, checkout: false }]) {
      ctx = await setup(opts)
      const { auth } = await loginAdmin(ctx.call)
      const P = await acceptedProject(ctx, auth)
      const v = await ctx.call('GET', `/projects/${P.reference}`, { headers: P.h })
      expect(v.body.data.payment.canPay).toBe(false)
      const r = await ctx.call('POST', `/projects/${P.reference}/payments/checkout`, { json: {}, headers: P.h })
      expect(r.status).toBe(409)
      expect(r.body.error.code).toBe('PAYMENTS_DISABLED')
    }
    expect(fake.calls.filter((c) => c.url.includes('createInvoice'))).toHaveLength(0)
  })
  it('callback returns 503 when not configured', async () => {
    ctx = await setup()
    expect((await ctx.form('/payments/duitku/callback', callbackFields('X', 1))).status).toBe(503)
  })
  it('admin status probe masks the merchant code and never returns the API key', async () => {
    ctx = await setup({ duitku: true })
    const { auth } = await loginAdmin(ctx.call)
    const s = await ctx.call('GET', '/admin/payments/duitku/status', { headers: auth })
    expect(s.body.data).toMatchObject({ configured: true, environment: 'sandbox', credentialsVerified: true, checkoutEnabled: true })
    expect(JSON.stringify(s.body)).not.toContain(DUITKU_TEST.apiKey)
    expect(JSON.stringify(s.body)).not.toContain(DUITKU_TEST.merchantCode)
    expect((await ctx.call('GET', '/admin/payments/duitku/status')).status).toBe(401)
  })
})

describe('Duitku POP — checkout', () => {
  it('creates an invoice with the server-side quote amount and signed headers; reuses a pending invoice', async () => {
    ctx = await setup({ duitku: true })
    const { auth } = await loginAdmin(ctx.call)
    const P = await acceptedProject(ctx, auth, 2500000)
    const r = await ctx.call('POST', `/projects/${P.reference}/payments/checkout`, { json: { amountMinor: 1 }, headers: P.h })
    expect(r.status).toBe(201)
    expect(r.body.data.order).toMatchObject({ amountMinor: 2500000, status: 'pending' })
    expect(r.body.data.popScript).toBe('https://app-sandbox.duitku.com/lib/js/duitku.js')
    const inv = fake.calls.find((c) => c.url.includes('createInvoice'))!
    expect(inv.body).toMatchObject({ paymentAmount: 2500000, email: 'sinta@example.test', callbackUrl: 'https://avorlune.test/api/v1/payments/duitku/callback' })
    expect(JSON.stringify(inv.body)).not.toContain(DUITKU_TEST.apiKey)
    const again = await ctx.call('POST', `/projects/${P.reference}/payments/checkout`, { json: {}, headers: P.h })
    expect(again.status).toBe(200)
    expect(again.body.data.reused).toBe(true)
    expect(fake.calls.filter((c) => c.url.includes('createInvoice'))).toHaveLength(1)
  })
  it('requires an accepted quote, a payable status, an email for WhatsApp contacts, and a valid token', async () => {
    ctx = await setup({ duitku: true })
    const { auth } = await loginAdmin(ctx.call)
    const P = await acceptedProject(ctx, auth, 1000000, { contactMethod: 'whatsapp', contactValue: '+62 812 3456 7890' })
    expect((await ctx.call('POST', `/projects/${P.reference}/payments/checkout`, { json: {}, headers: P.h })).body.error.code).toBe('EMAIL_REQUIRED')
    expect((await ctx.call('POST', `/projects/${P.reference}/payments/checkout`, { json: { email: 'wa@example.test' }, headers: P.h })).status).toBe(201)
    expect((await ctx.call('POST', `/projects/${P.reference}/payments/checkout`, { json: {} })).status).toBe(404)
    // Not accepted quote
    const r = await ctx.call('POST', '/inquiries', { json: validInquiry() })
    const ref = r.body.data.reference
    const { id } = ctx.raw.prepare('SELECT id FROM projects WHERE public_reference = ?').get(ref) as { id: string }
    const link = await ctx.call('POST', `/admin/projects/${id}/access-link`, { json: {}, headers: auth })
    const t = (link.body.data.url as string).split('#t=')[1]
    expect((await ctx.call('POST', `/projects/${ref}/payments/checkout`, { json: {}, headers: { 'x-project-token': t } })).body.error.code).toBe('NOT_PAYABLE')
  })
  it('provider failure is surfaced as 502 and the order is marked failed', async () => {
    ctx = await setup({ duitku: true })
    fake.failInvoices()
    const { auth } = await loginAdmin(ctx.call)
    const P = await acceptedProject(ctx, auth)
    const r = await ctx.call('POST', `/projects/${P.reference}/payments/checkout`, { json: {}, headers: P.h })
    expect(r.status).toBe(502)
    expect(r.body.error.code).toBe('PAYMENT_PROVIDER_ERROR')
    expect((ctx.raw.prepare('SELECT status, failure_code FROM payment_orders').get() as { status: string; failure_code: string })).toEqual({ status: 'failed', failure_code: 'MERCHANT_NOT_FOUND' })
  })
})

describe('Duitku POP — callback & settlement', () => {
  async function pendingOrder(amount = 1500000) {
    ctx = await setup({ duitku: true })
    const { auth } = await loginAdmin(ctx.call)
    const P = await acceptedProject(ctx, auth, amount)
    const r = await ctx.call('POST', `/projects/${P.reference}/payments/checkout`, { json: {}, headers: P.h })
    return { ...P, auth, order: r.body.data.order as { id: string; merchantOrderId: string; amountMinor: number } }
  }
  const projectStatus = (id: string) => (ctx.raw.prepare('SELECT status FROM projects WHERE id = ?').get(id) as { status: string }).status
  const paymentsCount = () => (ctx.raw.prepare('SELECT COUNT(*) n FROM payments').get() as { n: number }).n

  it('rejects bad signature, wrong merchant, missing params, unknown order, amount mismatch — nothing is paid', async () => {
    const O = await pendingOrder()
    const mo = O.order.merchantOrderId
    expect((await ctx.form('/payments/duitku/callback', callbackFields(mo, 1500000, '00', 'f'.repeat(64)))).status).toBe(400)
    expect((await ctx.form('/payments/duitku/callback', { ...callbackFields(mo, 1500000), merchantCode: 'DEVIL1' })).status).toBe(400)
    expect((await ctx.form('/payments/duitku/callback', { merchantOrderId: mo })).status).toBe(400)
    expect((await ctx.form('/payments/duitku/callback', callbackFields('AVL-NOPE-1234', 1500000))).status).toBe(404)
    expect((await ctx.form('/payments/duitku/callback', callbackFields(mo, 1000))).text).toBe('Amount Mismatch')
    expect(paymentsCount()).toBe(0)
    expect(projectStatus(O.id)).toBe('quoted')
    const logged = ctx.raw.prepare('SELECT outcome, signature_valid FROM payment_callbacks ORDER BY created_at').all() as { outcome: string }[]
    expect(logged.map((l) => l.outcome)).toEqual(['bad_signature', 'bad_signature', 'bad_parameter', 'unknown_order', 'amount_mismatch'])
  })

  it('a validly-signed "success" callback is NOT trusted until Duitku transactionStatus confirms', async () => {
    const O = await pendingOrder()
    // Duitku still reports pending (01) → forged/early success must not settle.
    const r = await ctx.form('/payments/duitku/callback', callbackFields(O.order.merchantOrderId, 1500000, '00'))
    expect(r.status).toBe(409)
    expect(paymentsCount()).toBe(0)
  })

  it('confirmed success settles exactly once, records a gateway payment and queues production; duplicates are idempotent', async () => {
    const O = await pendingOrder()
    fake.state.set(O.order.merchantOrderId, { status: '00', amount: 1500000 })
    const first = await ctx.form('/payments/duitku/callback', callbackFields(O.order.merchantOrderId, 1500000))
    expect(first).toEqual({ status: 200, text: 'SUCCESS' })
    const dup = await ctx.form('/payments/duitku/callback', callbackFields(O.order.merchantOrderId, 1500000))
    expect(dup.status).toBe(200)
    expect(paymentsCount()).toBe(1)
    const pay = ctx.raw.prepare('SELECT status, amount_minor, method, confirmed_by FROM payments').get() as Record<string, unknown>
    expect(pay).toEqual({ status: 'paid', amount_minor: 1500000, method: 'duitku:SP', confirmed_by: null })
    expect(projectStatus(O.id)).toBe('queued')
    const ev = ctx.raw.prepare(`SELECT event_type, actor_type FROM project_events WHERE project_id = ? AND event_type IN ('payment_gateway_confirmed','status_changed') ORDER BY created_at DESC LIMIT 2`).all(O.id) as { event_type: string; actor_type: string }[]
    expect(ev.map((e) => e.actor_type)).toEqual(['system', 'system'])
    const v = await ctx.call('GET', `/projects/${O.reference}`, { headers: O.h })
    expect(v.body.data.payment.canPay).toBe(false)
    expect(v.body.data.payment.orders[0].status).toBe('paid')
    expect((await ctx.call('POST', `/projects/${O.reference}/payments/checkout`, { json: {}, headers: O.h })).status).toBe(409)
  })

  it('failed callback marks the order failed; Duitku-reported amount mismatch never settles', async () => {
    const O = await pendingOrder()
    expect((await ctx.form('/payments/duitku/callback', callbackFields(O.order.merchantOrderId, 1500000, '01'))).status).toBe(200)
    expect((ctx.raw.prepare('SELECT status FROM payment_orders').get() as { status: string }).status).toBe('failed')
    const O2 = await pendingOrder(900000)
    fake.state.set(O2.order.merchantOrderId, { status: '00', amount: 1 })
    expect((await ctx.form('/payments/duitku/callback', callbackFields(O2.order.merchantOrderId, 900000))).status).toBe(409)
    expect(paymentsCount()).toBe(0)
  })

  it('customer refresh reconciles server-to-server (pending → paid; cancelled; expired)', async () => {
    const O = await pendingOrder()
    const refresh = () => ctx.call('POST', `/projects/${O.reference}/payments/${O.order.id}/refresh`, { json: {}, headers: O.h })
    expect((await refresh()).body.data.outcome).toBe('pending')
    fake.state.set(O.order.merchantOrderId, { status: '00', amount: 1500000 })
    expect((await refresh()).body.data).toMatchObject({ outcome: 'paid', order: { status: 'paid' } })
    expect(projectStatus(O.id)).toBe('queued')
    const O2 = await pendingOrder()
    fake.state.set(O2.order.merchantOrderId, { status: '02', amount: 1500000 })
    expect((await ctx.call('POST', `/admin/projects/${O2.id}/payment-orders/${O2.order.id}/reconcile`, { json: {}, headers: O2.auth })).body.data.outcome).toBe('cancelled')
    const O3 = await pendingOrder()
    ctx.raw.prepare(`UPDATE payment_orders SET expires_at = '2000-01-01T00:00:00.000Z'`).run()
    expect((await ctx.call('POST', `/projects/${O3.reference}/payments/${O3.order.id}/refresh`, { json: {}, headers: O3.h })).body.data.outcome).toBe('expired')
  })

  it('a customer cannot refresh another project\u2019s order', async () => {
    const A = await pendingOrder()
    const { auth } = await loginAdmin(ctx.call)
    const B = await acceptedProject(ctx, auth, 700000, { title: 'Proyek B' })
    expect((await ctx.call('POST', `/projects/${B.reference}/payments/${A.order.id}/refresh`, { json: {}, headers: B.h })).status).toBe(404)
  })
})
