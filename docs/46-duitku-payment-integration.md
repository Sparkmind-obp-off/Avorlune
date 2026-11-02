# 46 — Duitku POP Payment Integration

**Status (2026-11-01):** POP integration implemented and deployed; production checkout remains OFF.  
**Environment decision:** AVORLUNE uses the owner's LIVE/PRODUCTION Duitku merchant credentials only. Do not use sandbox for these credentials.  
**Credential diagnostics:** production probes have returned signature/authentication errors; these are unresolved diagnostics, not evidence that the credentials are sandbox.

## 1. Scope

Online payment for an accepted quote via Duitku POP JS. Manual payment confirmation (docs/44) remains available and unchanged.

The detailed LIVE endpoint and operating directive is in **docs/52**. This document records the current repository implementation and observed evidence.

## 2. Production configuration

| Name | Where | Production value |
|---|---|---|
| `DUITKU_ENV` | Cloudflare production vars | `production` |
| `DUITKU_CHECKOUT_ENABLED` | Cloudflare production vars | `false` until verification + owner approval |
| `DUITKU_MERCHANT_CODE` | Cloudflare production secret | Set by owner |
| `DUITKU_API_KEY` | Cloudflare production secret | Set by owner; never print or expose |

The owner confirms the supplied merchant credentials are official LIVE/PRODUCTION credentials. They must not be routed to sandbox endpoints. Preview has no Duitku config and no production DB (fail-closed).

The current adapter retains a sandbox code path for isolated development compatibility, but it is not the AVORLUNE production operating mode and must never receive the owner's LIVE credentials.

## 3. Official production endpoints

| Function | Production endpoint |
|---|---|
| POP Create Invoice | `https://api-prod.duitku.com/api/merchant/createInvoice` |
| Get Payment Method | `https://passport.duitku.com/webapi/api/merchant/paymentmethod/getpaymentmethod` |
| Transaction Status | `https://passport.duitku.com/webapi/api/merchant/transactionStatus` |
| POP JavaScript | `https://app-prod.duitku.com/lib/js/duitku.js` |
| AVORLUNE callback | `https://avorlune.pages.dev/api/v1/payments/duitku/callback` |

Do not collapse these into one host. See docs/52 for method, request, signature and callback details.

## 4. Payment flow

1. Customer accepts quote → project `quoted`/`awaiting_payment`.
2. Portal `POST /api/v1/projects/:ref/payments/checkout` (`x-project-token`; body `{email?}` when contact is not email; 10/h/project). Server takes the amount only from the accepted quote, reuses a still-valid pending invoice, else calls production Duitku `createInvoice` (expiry 60 min) with a unique `merchantOrderId`, callback URL and return URL.
3. Browser loads production POP script and calls `checkout.process(reference, …)`.
4. POP JS events and return redirect are informational only. They must not change payment state.
5. Server refresh uses production `transactionStatus`.
6. Duitku sends server-to-server callback (`application/x-www-form-urlencoded`) to the AVORLUNE callback endpoint.

## 5. Settlement rules (`server/domain/payments.ts`)

- Callback signature: `HMAC_SHA256(merchantCode + amount + merchantOrderId, apiKey)`; verify in constant time and require matching merchant code.
- Payload cap and callback rate limit apply; callback events are recorded without secrets.
- Amount must equal the stored order amount.
- Callback `resultCode=00` is not trusted alone: server calls production `transactionStatus`; only `statusCode=00` with the exact amount settles.
- Provider unavailable → retryable response; callback can be retried.
- Settle once with guarded state transition and unique gateway payment reference.
- Repeated callbacks are idempotent.
- Browser JS callback and return URL never mark an order paid.

## 6. Current endpoints in AVORLUNE

| Endpoint | Auth |
|---|---|
| `POST /payments/duitku/callback` | Duitku HMAC signature |
| `POST /projects/:ref/payments/checkout` | project token |
| `POST /projects/:ref/payments/:orderId/refresh` | project token; order must belong to project |
| `GET /admin/payments/duitku/status` | admin; read-only payment-method probe; masked merchant code only |
| `GET /admin/projects/:id/payment-orders` | admin; orders + callback log |
| `POST /admin/projects/:id/payment-orders/:orderId/reconcile` | admin + CSRF; audited |

## 7. Data and refunds

Migration `0003_payments_duitku.sql` adds `payment_orders`, `payment_callbacks`, and a unique partial index for gateway payment references. Applied to production 2026-11-01 (bookmark before: `00000006-00000000-00005116-c931dd57e818bab9759200acc8efa1d5`).

Duitku refunds are not executed through the current API. Refunds remain a manual Duitku merchant-portal process, then recorded by admin. Refund automation is NOT STARTED.

## 8. Observed production diagnostics

The previous read-only diagnostics recorded:
- production payment-method probe: HTTP 403 `Invalid Signature` for tested signature variants;
- production transaction-status probe: HTTP 401 `Wrong signature` (the same response was observed for a deliberately invalid signature);
- an empty/invalid Create Invoice request returned a merchant-related error.

These observations do not prove the owner's credentials are sandbox, and an empty Create Invoice request is not a valid credential test. They indicate that the exact production request/authentication flow still needs diagnosis. The owner confirms the merchant credentials are LIVE/PRODUCTION.

No invoice or charge was created during those read-only diagnostics. Do not change the environment to sandbox or create an invoice just to debug authentication.

## 9. Safe diagnostic sequence

1. Inspect current adapter, tests and deployment config before changing code.
2. Confirm production runtime selects `DUITKU_ENV=production` and the production endpoints in §3.
3. Confirm the production secrets exist without printing their values.
4. Confirm merchant code and API key belong to the same LIVE project in the merchant portal.
5. Compare each API operation with its own current official documentation: method, content type, header names, timestamp units, Jakarta datetime, exact HMAC input order, amount representation and body serialization.
6. Use read-only production `getpaymentmethod` as the initial credential probe; respect provider rate limits.
7. Do not use an empty Create Invoice request as a credential test.
8. Do not create a real invoice during signature debugging.
9. Once read-only authentication passes, present the proposed low-value LIVE transaction and obtain explicit owner approval.
10. After approval, verify POP display, server callback, server-side transaction status, amount, idempotency and admin reconciliation.
11. Enable `DUITKU_CHECKOUT_ENABLED=true` only after owner approval and successful evidence-backed acceptance tests.

## 10. Checkout safety

Checkout remains OFF (`DUITKU_CHECKOUT_ENABLED=false`). No live transaction has been reported as completed. Manual payment confirmation remains the fallback. Do not claim online payment acceptance is live until a controlled owner-approved production payment has been verified end-to-end.

## 11. Official references

- Duitku POP API: https://docs.duitku.com/pop/id/
- Duitku API (payment methods and transaction status): https://docs.duitku.com/api/id/
- Merchant portal: https://passport.duitku.com/
- Detailed AVORLUNE LIVE directive: docs/52

## 12. Diagnostics with controls (2026-11-02, read-only, no invoice)
Run with `DUITKU_MERCHANT_CODE=… DUITKU_API_KEY=… node scripts/duitku-diagnose.mjs` (prints no secrets).
| Probe | Result |
|---|---|
| getpaymentmethod — documented HMAC_SHA256(merchantcode+amount+datetime), amount int and string | 403 `Invalid Signature.` |
| getpaymentmethod — legacy SHA256, uppercase-key variants | 403 `Invalid Signature.` |
| transactionStatus — documented HMAC_SHA256(merchantCode+merchantOrderId), JSON and form | 401 `Wrong signature` |
| **Control:** deliberately wrong key | 403 `Invalid Signature.` (identical) |
| **Control:** non-existent merchant code `DZZZZ1` | 404 `Merchant not found.` |

Interpretation: the configured merchant code exists in Duitku production (it is not "not found"), and our requests reach the signature check. Signatures built with the supplied key are rejected exactly like a deliberately wrong key. Formulas match the official docs for each endpoint; the key is 32 lowercase hex chars without whitespace; the sandbox clock matches Duitku's `Date` header. This points to the API key not being the key of that merchant project (e.g. copied from another project, regenerated afterwards, or truncated) — not to sandbox credentials and not to an implementation defect. **Owner action:** in passport.duitku.com → Project → the project with this merchant code, copy its API key again and provide it via a new upload; it will be stored with `wrangler pages secret put` only. Checkout stays OFF.

