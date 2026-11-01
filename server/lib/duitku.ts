import type { Env } from '../env'
import { safeEqual, toHex } from './crypto'

/**
 * Duitku POP adapter (docs/46). Endpoints and signature formulas follow docs.duitku.com/pop and
 * docs.duitku.com/api as read on 2026-11-01. All calls are server-side; the API key never leaves the Worker.
 */
export type DuitkuEnv = 'production' | 'sandbox'

const ENDPOINTS: Record<DuitkuEnv, { createInvoice: string; transactionStatus: string; paymentMethods: string; popScript: string }> = {
  production: {
    createInvoice: 'https://api-prod.duitku.com/api/merchant/createInvoice',
    transactionStatus: 'https://passport.duitku.com/webapi/api/merchant/transactionStatus',
    paymentMethods: 'https://passport.duitku.com/webapi/api/merchant/paymentmethod/getpaymentmethod',
    popScript: 'https://app-prod.duitku.com/lib/js/duitku.js',
  },
  sandbox: {
    createInvoice: 'https://api-sandbox.duitku.com/api/merchant/createInvoice',
    transactionStatus: 'https://sandbox.duitku.com/webapi/api/merchant/transactionStatus',
    paymentMethods: 'https://sandbox.duitku.com/webapi/api/merchant/paymentmethod/getpaymentmethod',
    popScript: 'https://app-sandbox.duitku.com/lib/js/duitku.js',
  },
}

export interface DuitkuConfig { env: DuitkuEnv; merchantCode: string; apiKey: string; endpoints: (typeof ENDPOINTS)[DuitkuEnv] }

export function getDuitkuConfig(env: Env): DuitkuConfig | null {
  const e = env.DUITKU_ENV
  const merchantCode = (env.DUITKU_MERCHANT_CODE ?? '').trim()
  const apiKey = (env.DUITKU_API_KEY ?? '').trim()
  if ((e !== 'production' && e !== 'sandbox') || !/^[A-Za-z0-9]{3,20}$/.test(merchantCode) || apiKey.length < 16) return null
  return { env: e, merchantCode, apiKey, endpoints: ENDPOINTS[e] }
}

/** Online checkout requires valid config AND an explicit operator switch (flipped only after credential verification). */
export function checkoutEnabled(env: Env) {
  return env.DUITKU_CHECKOUT_ENABLED === 'true' && getDuitkuConfig(env) !== null
}

export async function hmacHex(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)))
}

/** Callback signature: HMAC_SHA256(merchantCode + amount + merchantOrderId, apiKey), lowercase hex. Constant-time compare. */
export async function verifyCallbackSignature(cfg: DuitkuConfig, f: { merchantCode: string; amount: string; merchantOrderId: string; signature: string }) {
  if (!safeEqual(f.merchantCode, cfg.merchantCode)) return false
  const expected = await hmacHex(cfg.apiKey, f.merchantCode + f.amount + f.merchantOrderId)
  return safeEqual(expected, (f.signature ?? '').toLowerCase())
}

export class DuitkuError extends Error {
  constructor(public code: string, public httpStatus: number) { super(code) }
}

function classify(status: number, text: string): string {
  const t = text.toLowerCase()
  if (t.includes('merchant not found')) return 'MERCHANT_NOT_FOUND'
  if (t.includes('signature')) return 'INVALID_SIGNATURE'
  if (t.includes('not found')) return 'NOT_FOUND'
  if (status >= 500) return 'PROVIDER_UNAVAILABLE'
  return `HTTP_${status}`
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}, timeoutMs = 15000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', ...headers }, body: JSON.stringify(body), signal: ctrl.signal })
    const text = await res.text()
    let json: Record<string, unknown> | null = null
    try { json = JSON.parse(text) } catch { json = null }
    return { status: res.status, text, json }
  } catch {
    throw new DuitkuError('PROVIDER_UNREACHABLE', 0)
  } finally {
    clearTimeout(timer)
  }
}

export interface InvoiceInput {
  merchantOrderId: string; amount: number; productDetails: string; email: string; phoneNumber?: string
  customerVaName: string; itemName: string; callbackUrl: string; returnUrl: string; expiryMinutes: number
}

export async function createInvoice(cfg: DuitkuConfig, i: InvoiceInput) {
  const ts = String(Date.now())
  const signature = await hmacHex(cfg.apiKey, cfg.merchantCode + ts)
  const body = {
    paymentAmount: i.amount,
    merchantOrderId: i.merchantOrderId,
    productDetails: i.productDetails.slice(0, 255),
    additionalParam: '',
    merchantUserInfo: '',
    paymentMethod: '',
    customerVaName: i.customerVaName.slice(0, 20),
    email: i.email,
    phoneNumber: i.phoneNumber ?? '',
    itemDetails: [{ name: i.itemName.slice(0, 50), price: i.amount, quantity: 1 }],
    callbackUrl: i.callbackUrl,
    returnUrl: i.returnUrl,
    expiryPeriod: i.expiryMinutes,
  }
  const r = await postJson(cfg.endpoints.createInvoice, body, { 'x-duitku-timestamp': ts, 'x-duitku-signature': signature, 'x-duitku-merchantcode': cfg.merchantCode })
  const j = r.json as { reference?: string; paymentUrl?: string; statusCode?: string } | null
  if (r.status !== 200 || !j || j.statusCode !== '00' || !j.reference) throw new DuitkuError(classify(r.status, r.text), r.status)
  return { reference: String(j.reference), paymentUrl: String(j.paymentUrl ?? '') }
}

export async function checkTransaction(cfg: DuitkuConfig, merchantOrderId: string) {
  const signature = await hmacHex(cfg.apiKey, cfg.merchantCode + merchantOrderId)
  const r = await postJson(cfg.endpoints.transactionStatus, { merchantCode: cfg.merchantCode, merchantOrderId, signature })
  const j = r.json as { statusCode?: string; amount?: string; reference?: string } | null
  if (r.status !== 200 || !j || typeof j.statusCode !== 'string') throw new DuitkuError(classify(r.status, r.text), r.status)
  return { statusCode: j.statusCode, amount: Math.round(Number(j.amount ?? 'NaN')), reference: j.reference ? String(j.reference) : null }
}

function jakartaDatetime(d = new Date()) {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().replace('T', ' ').slice(0, 19)
}

/** Read-only credential probe: lists active payment methods. Creates no transaction. */
export async function probeCredentials(cfg: DuitkuConfig) {
  const amount = 10000
  const datetime = jakartaDatetime()
  const signature = await hmacHex(cfg.apiKey, cfg.merchantCode + amount + datetime)
  try {
    const r = await postJson(cfg.endpoints.paymentMethods, { merchantcode: cfg.merchantCode, amount, datetime, signature })
    const j = r.json as { responseCode?: string; paymentFee?: { paymentMethod: string; paymentName: string }[]; Message?: string; responseMessage?: string } | null
    if (r.status === 200 && j?.responseCode === '00') return { ok: true as const, methods: (j.paymentFee ?? []).map((m) => ({ code: m.paymentMethod, name: m.paymentName })) }
    return { ok: false as const, code: classify(r.status, `${j?.Message ?? ''} ${j?.responseMessage ?? ''} ${r.text}`) }
  } catch (e) {
    return { ok: false as const, code: e instanceof DuitkuError ? e.code : 'ERROR' }
  }
}
