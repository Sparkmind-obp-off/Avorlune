# 46 — Duitku POP Payment Integration

Status (2026-11-01): **IMPLEMENTED · TESTED (local, 12 integration tests) · DEPLOYED (production, checkout OFF)** · Credentials **BLOCKED** (rejected by Duitku production, see §8).

## 1. Scope
Online payment for an accepted quote via Duitku POP JS. Manual payment confirmation (docs/44) remains available and is unchanged.

## 2. Configuration
| Name | Where | Value |
|---|---|---|
| `DUITKU_ENV` | `wrangler.jsonc` env.production vars | `production` (`sandbox` supported) |
| `DUITKU_CHECKOUT_ENABLED` | `wrangler.jsonc` env.production vars | `false` — customer checkout is refused (409 `PAYMENTS_DISABLED`) unless exactly `true` |
| `DUITKU_MERCHANT_CODE` | Cloudflare Pages secret (production) | set 2026-11-01 |
| `DUITKU_API_KEY` | Cloudflare Pages secret (production) | set 2026-11-01 |

Preview has **no** Duitku config and no DB (fail-closed). Static test `tests/unit/config.test.ts` asserts: checkout default OFF, no key/merchant code in config, no 32-hex strings in `wrangler.jsonc`, preview has no `DUITKU*` vars, CSP `script-src` only allows the two official POP hosts.

## 3. Flow
1. Customer accepts quote → project `quoted`/`awaiting_payment`.
2. Portal `POST /api/v1/projects/:ref/payments/checkout` (`x-project-token`; body `{email?}` when contact is not email; 10/h/project). Server takes the amount **only** from the accepted quote, reuses a still-valid pending invoice, else calls Duitku `createInvoice` (expiry 60 min) with `merchantOrderId = <reference>-<hex4>`, `callbackUrl = <origin>/api/v1/payments/duitku/callback`, `returnUrl = <origin>/p/<ref>?payment=return`.
3. Browser loads POP script (host allowlisted in code + CSP) and calls `checkout.process(reference, …)`. Fallback: redirect to `paymentUrl` (only `*.duitku.com`).
4. Any POP event or return redirect only triggers `POST …/payments/:orderId/refresh` → server-to-server `transactionStatus`. The browser never sets status.
5. Duitku callback (`application/x-www-form-urlencoded`) → `POST /api/v1/payments/duitku/callback`.

## 4. Settlement rules (`server/domain/payments.ts`)
- Callback signature `HMAC_SHA256(merchantCode + amount + merchantOrderId, apiKey)` verified in constant time; merchant code must match; 16 KB cap; 120/min rate limit. Every callback is recorded in `payment_callbacks` (outcome, no secrets).
- Amount must equal the order amount, else `Amount Mismatch` (logged as error, nothing paid).
- `resultCode=00` is **not trusted alone**: server calls `transactionStatus`; only `statusCode=00` with the exact amount settles. Provider unavailable → 503 `Retry Later` (Duitku retries).
- Settle once: guarded update `status IN ('created','pending')` → insert `payments` row (method `duitku:<code>`, status `paid`, `confirmed_by` NULL) + `payment_gateway_confirmed` event → system transition to `queued`. Unique partial index `idx_payments_gateway_ref` blocks duplicate gateway payments. Repeat callbacks answer `SUCCESS` idempotently.
- `resultCode=01` / status `02` → `failed`; elapsed `expires_at` → `expired`; admin reconcile can mark `cancelled`.

## 5. Endpoints
| Endpoint | Auth |
|---|---|
| `POST /payments/duitku/callback` | Duitku signature |
| `POST /projects/:ref/payments/checkout` | project token |
| `POST /projects/:ref/payments/:orderId/refresh` | project token (order must belong to project) |
| `GET /admin/payments/duitku/status` | admin — read-only `getpaymentmethod` probe; returns masked merchant code, never the key; 20/h |
| `GET /admin/projects/:id/payment-orders` | admin — orders + callback log |
| `POST /admin/projects/:id/payment-orders/:orderId/reconcile` | admin + CSRF — audited `payment_reconciled` |

## 6. Data (migration `0003_payments_duitku.sql`, additive)
`payment_orders`, `payment_callbacks`, unique partial index on `payments(provider_reference)` for `duitku%` methods. Applied to production 2026-11-01 (bookmark before: `00000006-00000000-00005116-c931dd57e818bab9759200acc8efa1d5`).

## 7. Refunds
Duitku refunds are **not** executed through the API. Refund = manual process in the Duitku portal, then recorded by admin (existing `payments` status / cost ledger `refund` entries). Refund status automation: **NOT STARTED**.

## 8. Credential verification evidence (read-only, no invoice created)
| Probe | Result |
|---|---|
| Production `getpaymentmethod` (HMAC-SHA256 and legacy SHA256 signature variants) | 403 `Invalid Signature` |
| Production `transactionStatus` | 401 `Wrong signature` (same for a garbage signature) |
| Production/sandbox `createInvoice` (empty body) | 400 `Merchant Not Found` |
| Sandbox `getpaymentmethod` | 404 `Merchant not found` |

Conclusion: Duitku production does not accept the supplied merchant code + API key pair. **Owner action:** in the Duitku merchant portal check that (a) the project for merchant code D2***9 (as stored in the Cloudflare secret) is the one the key was copied from, (b) the key was copied completely (32 hex chars, no spaces), (c) the project is activated for production, (d) set Callback URL `https://avorlune.pages.dev/api/v1/payments/duitku/callback` and Return URL `https://avorlune.pages.dev`. Then: rotate secret if needed (`wrangler pages secret put DUITKU_API_KEY`), open Admin → project → *Gateway Duitku* (must show "Terverifikasi"), and only after owner approval set `DUITKU_CHECKOUT_ENABLED` to `"true"` and redeploy. First live transaction must be a small owner-authorised test.

## 9. Live smoke tests (2026-11-01, deployment 7cc67c20)
`/health` 200 · callback bad signature → 400 `Bad Signature` · callback missing params → 400 `Bad Parameter` · preview callback → 503 `DATABASE_UNAVAILABLE` · admin status unauthenticated → 401 · checkout without token → 404 · CSP header includes only Duitku POP hosts.
