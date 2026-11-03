import { beforeEach, describe, expect, it } from 'vitest'
import { loginAdmin, payBalance, setup, toCustomerReview, validInquiry, ADMIN_PASSWORD } from '../helpers/app'
import { PNG } from '../helpers/store'

type Ctx = Awaited<ReturnType<typeof setup>>
let ctx: Ctx
beforeEach(async () => { ctx = await setup({ assets: true }) })

const expireReauth = (c: Ctx) => c.raw.prepare(`UPDATE sessions SET reauth_at = '2000-01-01T00:00:00.000Z'`).run()

async function paidProject(c: Ctx, auth: Record<string, string>) {
  const r = await toCustomerReview(c, auth)
  const pay = c.raw.prepare(`SELECT id, amount_minor FROM payments WHERE project_id = ?`).get(r.id) as { id: string; amount_minor: number }
  return { ...r, paymentId: pay.id, amount: pay.amount_minor }
}

describe('step-up re-authentication (docs/48 §5)', () => {
  it('sensitive actions require a recent password confirmation; reauth unlocks them', async () => {
    const { auth } = await loginAdmin(ctx.call)
    const r = await ctx.call('POST', '/inquiries', { json: validInquiry() })
    const { id } = ctx.raw.prepare('SELECT id FROM projects WHERE public_reference = ?').get(r.body.data.reference) as { id: string }
    // Fresh login counts as recent auth.
    expect((await ctx.call('GET', `/admin/projects/${id}/export`, { headers: auth })).status).toBe(200)
    expireReauth(ctx)
    expect((await ctx.call('GET', `/admin/projects/${id}/export`, { headers: auth })).body.error.code).toBe('REAUTH_REQUIRED')
    expect((await ctx.call('POST', `/admin/projects/${id}/payments/confirm`, { json: { amountMinor: 1000, method: 'Transfer' }, headers: auth })).body.error.code).toBe('REAUTH_REQUIRED')
    expect((await ctx.call('POST', `/admin/projects/${id}/access-link?revokePrevious=true`, { json: {}, headers: auth })).body.error.code).toBe('REAUTH_REQUIRED')
    // Issuing a link without revoking stays available.
    expect((await ctx.call('POST', `/admin/projects/${id}/access-link`, { json: {}, headers: auth })).status).toBe(201)
    expect((await ctx.call('GET', '/admin/auth/me', { headers: auth })).body.data.recentAuth).toBe(false)
    expect((await ctx.call('POST', '/admin/auth/reauth', { json: { password: 'wrong-password-xx' }, headers: auth })).status).toBe(401)
    expect((await ctx.call('POST', '/admin/auth/reauth', { json: { password: ADMIN_PASSWORD }, headers: auth })).status).toBe(200)
    expect((await ctx.call('GET', `/admin/projects/${id}/export`, { headers: auth })).status).toBe(200)
  })
  it('reauth requires an admin session and CSRF', async () => {
    expect((await ctx.call('POST', '/admin/auth/reauth', { json: { password: ADMIN_PASSWORD } })).status).toBe(401)
    const { cookie } = await loginAdmin(ctx.call)
    expect((await ctx.call('POST', '/admin/auth/reauth', { json: { password: ADMIN_PASSWORD }, headers: { cookie } })).status).toBe(403)
  })
})

describe('manual refund workflow', () => {
  it('request → processed marks the payment refunded once fully covered; audited and notified', async () => {
    const { auth } = await loginAdmin(ctx.call)
    const p = await paidProject(ctx, auth)
    const over = await ctx.call('POST', `/admin/projects/${p.id}/refunds`, { json: { paymentId: p.paymentId, amountMinor: p.amount + 1, reason: 'Klien membatalkan', channel: 'bank_transfer' }, headers: auth })
    expect(over.body.error.code).toBe('REFUND_EXCEEDS_PAYMENT')
    const half = Math.floor(p.amount / 2)
    const r1 = await ctx.call('POST', `/admin/projects/${p.id}/refunds`, { json: { paymentId: p.paymentId, amountMinor: half, reason: 'Refund sebagian', channel: 'bank_transfer' }, headers: auth })
    expect(r1.status).toBe(201)
    // Open request reserves the amount.
    expect((await ctx.call('POST', `/admin/projects/${p.id}/refunds`, { json: { paymentId: p.paymentId, amountMinor: p.amount - half + 1, reason: 'Terlalu banyak', channel: 'bank_transfer' }, headers: auth })).body.error.code).toBe('REFUND_EXCEEDS_PAYMENT')
    // processed needs a provider/bank reference
    expect((await ctx.call('POST', `/admin/projects/${p.id}/refunds/${r1.body.data.id}/resolve`, { json: { decision: 'processed' }, headers: auth })).status).toBe(422)
    expect((await ctx.call('POST', `/admin/projects/${p.id}/refunds/${r1.body.data.id}/resolve`, { json: { decision: 'processed', providerReference: 'TRF-001' }, headers: auth })).status).toBe(200)
    expect((await ctx.call('POST', `/admin/projects/${p.id}/refunds/${r1.body.data.id}/resolve`, { json: { decision: 'processed', providerReference: 'TRF-001' }, headers: auth })).body.error.code).toBe('ALREADY_RESOLVED')
    expect((ctx.raw.prepare('SELECT status FROM payments WHERE id = ?').get(p.paymentId) as { status: string }).status).toBe('manually_confirmed')
    const r2 = await ctx.call('POST', `/admin/projects/${p.id}/refunds`, { json: { paymentId: p.paymentId, amountMinor: p.amount - half, reason: 'Sisa refund', channel: 'bank_transfer' }, headers: auth })
    expect((await ctx.call('POST', `/admin/projects/${p.id}/refunds/${r2.body.data.id}/resolve`, { json: { decision: 'processed', providerReference: 'TRF-002' }, headers: auth })).status).toBe(200)
    expect((ctx.raw.prepare('SELECT status FROM payments WHERE id = ?').get(p.paymentId) as { status: string }).status).toBe('refunded')
    const ev = ctx.raw.prepare(`SELECT event_type FROM project_events WHERE project_id = ? AND event_type LIKE 'refund_%'`).all(p.id) as { event_type: string }[]
    expect(ev.map((e) => e.event_type).sort()).toEqual(['refund_processed', 'refund_processed', 'refund_requested', 'refund_requested'])
    expect((ctx.raw.prepare(`SELECT COUNT(*) n FROM notifications WHERE project_id = ? AND event = 'refund_processed'`).get(p.id) as { n: number }).n).toBe(2)
    // Customer sees refund status only.
    const view = await ctx.call('GET', `/projects/${p.reference}`, { headers: { 'x-project-token': p.token } })
    expect(view.body.data.refunds).toHaveLength(2)
    expect(view.body.data.refunds[0]).not.toHaveProperty('reason')
  })
  it('resolving a refund requires step-up auth; rejection requires a note', async () => {
    const { auth } = await loginAdmin(ctx.call)
    const p = await paidProject(ctx, auth)
    const r = await ctx.call('POST', `/admin/projects/${p.id}/refunds`, { json: { paymentId: p.paymentId, amountMinor: 1000, reason: 'Uji coba refund', channel: 'other' }, headers: auth })
    expect(r.status, JSON.stringify(r.body)).toBe(201)
    expect((await ctx.call('POST', `/admin/projects/${p.id}/refunds/${r.body.data.id}/resolve`, { json: { decision: 'rejected' }, headers: auth })).status).toBe(422)
    expireReauth(ctx)
    expect((await ctx.call('POST', `/admin/projects/${p.id}/refunds/${r.body.data.id}/resolve`, { json: { decision: 'rejected', note: 'Di luar kebijakan' }, headers: auth })).body.error.code).toBe('REAUTH_REQUIRED')
  })
  it('a refund cannot target another project’s payment', async () => {
    const { auth } = await loginAdmin(ctx.call)
    const a = await paidProject(ctx, auth)
    const b = await paidProject(ctx, auth)
    expect((await ctx.call('POST', `/admin/projects/${b.id}/refunds`, { json: { paymentId: a.paymentId, amountMinor: 1000, reason: 'Salah proyek', channel: 'other' }, headers: auth })).status).toBe(404)
  })
})

describe('asset licensing registry + delivery gate', () => {
  async function approved(c: Ctx, auth: Record<string, string>) {
    const p = await toCustomerReview(c, auth)
    const r = await c.call('POST', `/projects/${p.reference}/feedback`, { json: { message: 'oke tapi ganti warna' }, headers: { 'x-project-token': p.token } })
    expect(r.status).toBe(201)
    await p.patch('producing')
    const fin = await c.upload(p.id, 'final', PNG, auth)
    await p.patch('internal_review')
    await p.patch('customer_review')
    expect((await c.call('POST', `/projects/${p.reference}/approval`, { json: { assetId: fin.body.data.id }, headers: { 'x-project-token': p.token } })).status).toBe(200)
    return { ...p, assetId: fin.body.data.id as string }
  }
  it('delivery requires a QA-approved licence with commercial use allowed + evidence', async () => {
    const { auth } = await loginAdmin(ctx.call)
    const p = await approved(ctx, auth)
    expect((await ctx.call('PATCH', `/admin/projects/${p.id}/status`, { json: { toStatus: 'delivered' }, headers: auth })).body.error.code).toBe('LICENSE_CLEARANCE_REQUIRED')
    expect((await ctx.call('POST', `/admin/projects/${p.id}/licenses`, { json: { assetId: p.assetId, sourceType: 'ai_generated', commercialUse: 'allowed' }, headers: auth })).body.error.code).toBe('PROVIDER_REQUIRED')
    expect((await ctx.call('POST', `/admin/projects/${p.id}/licenses`, { json: { assetId: p.assetId, sourceType: 'ai_generated', providerSlug: 'nope', commercialUse: 'allowed' }, headers: auth })).body.error.code).toBe('UNKNOWN_PROVIDER')
    const unverified = await ctx.call('POST', `/admin/projects/${p.id}/licenses`, { json: { assetId: p.assetId, sourceType: 'ai_generated', providerSlug: 'genspark', commercialUse: 'unverified' }, headers: auth })
    expect((await ctx.call('POST', `/admin/projects/${p.id}/licenses/${unverified.body.data.id}/qa`, { json: { deliveryPermitted: true }, headers: auth })).body.error.code).toBe('LICENSE_NOT_CLEARED')
    const ok = await ctx.call('POST', `/admin/projects/${p.id}/licenses`, { json: { assetId: p.assetId, sourceType: 'ai_generated', providerSlug: 'genspark', commercialUse: 'allowed', licenseEvidence: 'Plus aktif, invoice INV-1' }, headers: auth })
    expect((await ctx.call('PATCH', `/admin/projects/${p.id}/status`, { json: { toStatus: 'delivered' }, headers: auth })).body.error.code).toBe('LICENSE_CLEARANCE_REQUIRED')
    expect((await ctx.call('POST', `/admin/projects/${p.id}/licenses/${ok.body.data.id}/qa`, { json: { deliveryPermitted: true }, headers: auth })).status).toBe(200)
    await payBalance(ctx, auth, p.id)
    expect((await ctx.call('PATCH', `/admin/projects/${p.id}/status`, { json: { toStatus: 'delivered' }, headers: auth })).status).toBe(200)
    expect((ctx.raw.prepare(`SELECT COUNT(*) n FROM notifications WHERE project_id = ? AND event = 'final_delivered'`).get(p.id) as { n: number }).n).toBe(1)
  })
  it('a not_allowed source on the final asset blocks delivery even with another cleared record', async () => {
    const { auth } = await loginAdmin(ctx.call)
    const p = await approved(ctx, auth)
    const ok = await ctx.call('POST', `/admin/projects/${p.id}/licenses`, { json: { assetId: p.assetId, sourceType: 'ai_generated', providerSlug: 'genspark', commercialUse: 'allowed', licenseEvidence: 'Plus' }, headers: auth })
    await ctx.call('POST', `/admin/projects/${p.id}/licenses/${ok.body.data.id}/qa`, { json: { deliveryPermitted: true }, headers: auth })
    await ctx.call('POST', `/admin/projects/${p.id}/licenses`, { json: { assetId: p.assetId, sourceType: 'third_party', commercialUse: 'not_allowed', sourceMaterial: 'Musik tanpa lisensi' }, headers: auth })
    expect((await ctx.call('PATCH', `/admin/projects/${p.id}/status`, { json: { toStatus: 'delivered' }, headers: auth })).body.error.code).toBe('LICENSE_BLOCKED')
  })
  it('licence records cannot reference another project’s asset', async () => {
    const { auth } = await loginAdmin(ctx.call)
    const a = await approved(ctx, auth)
    const b = await toCustomerReview(ctx, auth)
    expect((await ctx.call('POST', `/admin/projects/${b.id}/licenses`, { json: { assetId: a.assetId, sourceType: 'customer_provided', commercialUse: 'allowed' }, headers: auth })).status).toBe(404)
  })
  it('provider registry is seeded from verified terms and editable by admin only', async () => {
    const { auth } = await loginAdmin(ctx.call)
    const list = await ctx.call('GET', '/admin/providers', { headers: auth })
    expect(list.body.data.providers[0]).toMatchObject({ slug: 'genspark', commercial_use: 'restricted', api_available: 'no' })
    expect((await ctx.call('GET', '/admin/providers')).status).toBe(401)
    expect((await ctx.call('PATCH', '/admin/providers/genspark', { json: { notes: 'Owner: Plus aktif sejak Nov 2026' }, headers: auth })).status).toBe(200)
    expect((await ctx.call('PATCH', '/admin/providers/unknown', { json: { notes: 'x' }, headers: auth })).status).toBe(404)
  })
})

describe('notification outbox', () => {
  it('lifecycle events enqueue deduplicated notifications; manual send/cancel are audited', async () => {
    const { auth } = await loginAdmin(ctx.call)
    const p = await toCustomerReview(ctx, auth)
    const events = (ctx.raw.prepare('SELECT event FROM notifications WHERE project_id = ? ORDER BY created_at').all(p.id) as { event: string }[]).map((e) => e.event)
    expect(events).toEqual(expect.arrayContaining(['project_submitted', 'quote_sent', 'quote_accepted', 'payment_success', 'production_started', 'ready_for_review']))
    // No contact details are copied into the outbox.
    const row = ctx.raw.prepare('SELECT * FROM notifications WHERE project_id = ? LIMIT 1').get(p.id) as Record<string, string>
    expect(JSON.stringify(row)).not.toContain('sinta@example.test')
    const list = await ctx.call('GET', '/admin/notifications?status=pending', { headers: auth })
    expect(list.body.data.emailSending).toBe(false)
    const nid = list.body.data.notifications[0].id
    expect((await ctx.call('POST', `/admin/notifications/${nid}/retry`, { json: {}, headers: auth })).status).toBe(409)
    expect((await ctx.call('POST', `/admin/notifications/${nid}/manual-sent`, { json: {}, headers: auth })).status).toBe(200)
    expect((await ctx.call('POST', `/admin/notifications/${nid}/manual-sent`, { json: {}, headers: auth })).status).toBe(409)
    expect((ctx.raw.prepare(`SELECT COUNT(*) n FROM project_events WHERE event_type = 'notification_manual_sent'`).get() as { n: number }).n).toBe(1)
    // Outbox processing is a no-op while email sending is not configured/approved.
    expect((await ctx.call('POST', '/admin/notifications/process', { json: {}, headers: auth })).body.data).toMatchObject({ enabled: false, sent: 0 })
  })
})

describe('customer support + admin dashboard', () => {
  it('customer opens a ticket via the project token; admin resolves it; dashboard counts it', async () => {
    const { auth } = await loginAdmin(ctx.call)
    const p = await toCustomerReview(ctx, auth)
    const h = { 'x-project-token': p.token }
    expect((await ctx.call('POST', `/projects/${p.reference}/support`, { json: { category: 'issue', message: 'x' }, headers: h })).status).toBe(422)
    expect((await ctx.call('POST', `/projects/${p.reference}/support`, { json: { category: 'issue', message: 'File tidak bisa dibuka' } })).status).toBe(404)
    const t = await ctx.call('POST', `/projects/${p.reference}/support`, { json: { category: 'issue', message: 'File tidak bisa dibuka' }, headers: h })
    expect(t.status).toBe(201)
    const dash = await ctx.call('GET', '/admin/dashboard', { headers: auth })
    expect(dash.body.data.openSupportTickets).toBe(1)
    expect(dash.body.data.settings).toMatchObject({ checkoutEnabled: false, emailSending: false, privateDelivery: true })
    expect(JSON.stringify(dash.body.data)).not.toMatch(/apiKey|API_KEY|secret/i)
    expect((await ctx.call('GET', '/admin/dashboard')).status).toBe(401)
    expect((await ctx.call('GET', '/admin/dashboard', { headers: h })).status).toBe(401)
    expect((await ctx.call('POST', `/admin/support/${t.body.data.id}/resolve`, { json: { note: 'File dikirim ulang' }, headers: auth })).status).toBe(200)
    const view = await ctx.call('GET', `/projects/${p.reference}`, { headers: h })
    expect(view.body.data.support[0]).toMatchObject({ status: 'resolved', resolution_note: 'File dikirim ulang' })
  })
  it('customer tokens never satisfy admin operations routes', async () => {
    const { auth } = await loginAdmin(ctx.call)
    const p = await toCustomerReview(ctx, auth)
    const h = { 'x-project-token': p.token }
    for (const [m, path] of [['GET', '/admin/notifications'], ['GET', '/admin/support'], ['POST', `/admin/projects/${p.id}/refunds`], ['POST', `/admin/projects/${p.id}/licenses`]] as const) {
      expect((await ctx.call(m, path, { json: m === 'POST' ? {} : undefined, headers: h })).status).toBe(401)
    }
  })
})
