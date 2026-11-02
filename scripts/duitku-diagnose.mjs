#!/usr/bin/env node
/**
 * Read-only Duitku LIVE credential diagnostic (docs/52 §9). Creates NO invoice and NO charge.
 * Reads DUITKU_MERCHANT_CODE / DUITKU_API_KEY from the environment; never prints them or full signatures.
 * Calls only: production getpaymentmethod, production transactionStatus for a non-existent order id.
 *   DUITKU_MERCHANT_CODE=... DUITKU_API_KEY=... node scripts/duitku-diagnose.mjs
 */
import { createHmac, createHash } from 'node:crypto'

const MC = (process.env.DUITKU_MERCHANT_CODE ?? '').trim()
const KEY = (process.env.DUITKU_API_KEY ?? '').trim()
if (!MC || !KEY) { console.error('DUITKU_MERCHANT_CODE and DUITKU_API_KEY must be set in the environment'); process.exit(2) }

const PM = 'https://passport.duitku.com/webapi/api/merchant/paymentmethod/getpaymentmethod'
const TS = 'https://passport.duitku.com/webapi/api/merchant/transactionStatus'
const hmac = (k, s) => createHmac('sha256', k).update(s).digest('hex')
const jakarta = (d = new Date()) => new Date(d.getTime() + 7 * 3600_000).toISOString().replace('T', ' ').slice(0, 19)

const shape = (s) => ({ length: s.length, charset: /^[0-9a-f]+$/.test(s) ? 'hex-lower' : /^[0-9A-F]+$/.test(s) ? 'hex-upper' : /^[0-9A-Fa-f]+$/.test(s) ? 'hex-mixed' : 'other', whitespaceInside: /\s/.test(s) })
console.log(JSON.stringify({ merchantCode: { masked: MC.slice(0, 2) + '***' + MC.slice(-1), length: MC.length }, apiKey: shape(KEY), clockUtc: new Date().toISOString() }))

async function call(label, url, body, form = false) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json', accept: 'application/json' },
    body: form ? new URLSearchParams(body).toString() : JSON.stringify(body),
  })
  const text = (await res.text()).replace(/\s+/g, ' ').slice(0, 160)
  const date = res.headers.get('date')
  console.log(JSON.stringify({ probe: label, http: res.status, response: text, serverDate: date }))
  return res.status
}

const amount = 10000
const dt = jakarta()
// 1. Documented formula (docs.duitku.com/api/id — Get Payment Method)
await call('getpaymentmethod:hmac-documented', PM, { merchantcode: MC, amount, datetime: dt, signature: hmac(KEY, MC + amount + dt) })
// 2. Same, amount as string (as in the documented curl example)
await call('getpaymentmethod:hmac-amount-string', PM, { merchantcode: MC, amount: String(amount), datetime: dt, signature: hmac(KEY, MC + amount + dt) })
// 3. Legacy formula (older Duitku docs): SHA256(merchantcode + amount + datetime + apiKey)
await call('getpaymentmethod:legacy-sha256', PM, { merchantcode: MC, amount, datetime: dt, signature: createHash('sha256').update(MC + amount + dt + KEY).digest('hex') })
// 4. Transaction status for a random non-existent order: JSON (documented curl) and form (documented table)
const oid = 'AVL-DIAG-' + Date.now()
await call('transactionStatus:json-merchantCode', TS, { merchantCode: MC, merchantOrderId: oid, signature: hmac(KEY, MC + oid) })
await call('transactionStatus:form-merchantCode', TS, { merchantCode: MC, merchantOrderId: oid, signature: hmac(KEY, MC + oid) }, true)
// 5. Control: deliberately wrong key — if responses are identical to 1–4, the provider is rejecting the key/merchant pair itself.
await call('control:getpaymentmethod-wrong-key', PM, { merchantcode: MC, amount, datetime: dt, signature: hmac('wrong-key-control', MC + amount + dt) })
// 6. Control: non-existent merchant code — distinguishes "merchant unknown" from "key does not match merchant".
await call('control:getpaymentmethod-fake-merchant', PM, { merchantcode: 'DZZZZ1', amount, datetime: dt, signature: hmac(KEY, 'DZZZZ1' + amount + dt) })
await call('control:transactionStatus-fake-merchant', TS, { merchantCode: 'DZZZZ1', merchantOrderId: oid, signature: hmac(KEY, 'DZZZZ1' + oid) })
