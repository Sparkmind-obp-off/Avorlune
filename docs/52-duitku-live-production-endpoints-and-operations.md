# AVORLUNE — Duitku POP LIVE/PRODUCTION Integration & Operations

**Status:** LIVE/PRODUCTION is the only intended AVORLUNE environment  
**Checkout switch:** `DUITKU_CHECKOUT_ENABLED=false` until production auth verification and explicit owner approval  
**Credentials:** Owner states the supplied merchant credentials are official LIVE/PRODUCTION credentials. Never label them sandbox credentials or send them to sandbox endpoints.

## 1. Non-negotiable operating decision

- AVORLUNE uses Duitku POP JS with the owner's LIVE/PRODUCTION merchant project and credentials.
- Do not replace credentials, switch providers, or route the owner's production credentials to sandbox.
- Sandbox is not the test target for this integration.
- No invoice creation or real transaction is permitted merely to debug authentication.
- Read-only authentication/configuration checks must pass before asking for explicit approval of one small-value real payment.
- Keep checkout OFF until production credential/API authentication has been verified and the owner explicitly authorises enabling checkout.
- Never ask for the API key in chat. Store it only as a Cloudflare secret.

## 2. Official production endpoints

Duitku POP uses different production hosts for different API functions. Use the endpoint corresponding to the operation; do not assume every operation shares one hostname.

| Function | Production URL | Method / content |
|---|---|---|
| POP Create Invoice | `https://api-prod.duitku.com/api/merchant/createInvoice` | POST JSON |
| Get Payment Method | `https://passport.duitku.com/webapi/api/merchant/paymentmethod/getpaymentmethod` | POST JSON |
| Transaction Status | `https://passport.duitku.com/webapi/api/merchant/transactionStatus` | POST; request fields per current API docs |
| Duitku POP JavaScript | `https://app-prod.duitku.com/lib/js/duitku.js` | Browser script |
| AVORLUNE callback receiver | `https://avorlune.pages.dev/api/v1/payments/duitku/callback` | Public POST x-www-form-urlencoded |

The first four are Duitku production endpoints. The callback URL is AVORLUNE's merchant endpoint and must match the configured project callback URL.

## 3. POP Create Invoice authentication

Official POP documentation specifies:
- Generate timestamp as Unix milliseconds.
- `stringToSign = merchantCode + timestamp`
- `signature = HMAC_SHA256(stringToSign, apiKey)`, lowercase hexadecimal output.
- Headers:
  - `x-duitku-timestamp`
  - `x-duitku-signature`
  - `x-duitku-merchantcode`
  - `Content-Type: application/json`

The request body includes `paymentAmount`, unique `merchantOrderId`, `productDetails`, customer email, callback URL, return URL, and expiry. Where `itemDetails` is sent, the sum of item prices must equal `paymentAmount`; Duitku documents integer IDR amounts without decimal fractions.

The current repository adapter `server/lib/duitku.ts` implements this POP signature formula and production Create Invoice URL. Do not silently replace it with a legacy signature formula.

## 4. Payment method probe

The read-only `getpaymentmethod` probe uses the production host in §2. The current API reference describes:
- `merchantcode`
- `amount` (integer IDR)
- `datetime` in Jakarta format `YYYY-MM-DD HH:mm:ss`
- `signature = HMAC_SHA256(merchantCode + amount + datetime, apiKey)`

This operation lists payment methods and does not create an invoice. It is the preferred first diagnostic for verifying the merchant/API-key pair, subject to Duitku's current API rate limits.

## 5. Transaction status

The production `transactionStatus` endpoint is used for server-side confirmation. The documented signature is:
- `stringToSign = merchantCode + merchantOrderId`
- `signature = HMAC_SHA256(stringToSign, apiKey)`

The API response's `statusCode`, `amount`, and `reference` must be checked against the AVORLUNE order. Do not poll aggressively; Duitku documents rate limits and possible temporary blocking.

## 6. Callback and browser events

Duitku's server-to-server callback is POST `application/x-www-form-urlencoded`. Verify:
- merchant code equals configured merchant code;
- signature equals HMAC-SHA256 of `merchantCode + amount + merchantOrderId` using the merchant key;
- amount equals the stored order amount;
- merchant order ID and reference map to the expected pending order;
- transaction status is independently confirmed server-to-server before settlement.

Duitku's POP JS success/pending/error/close events and the browser return URL are customer-interface signals only. They must never mark an order paid. The server callback plus verified transaction-status response is authoritative. Respond HTTP 200 to a successfully processed callback; follow Duitku's documented retry behavior for temporary failures.

## 7. Cloudflare secret configuration

Production secrets:
- `DUITKU_MERCHANT_CODE`
- `DUITKU_API_KEY`

Production non-secret variables:
- `DUITKU_ENV=production`
- `DUITKU_CHECKOUT_ENABLED=false` until go-live approval.

Never put API key, merchant code, signatures containing sensitive material, or customer payment details in Git, frontend environment variables, public logs, issue reports, or chat. Rotate secrets through Cloudflare secret management if exposure is suspected.

Preview must not inherit production Duitku secrets or payment credentials.

## 8. Current implementation and observed evidence

Repository adapter currently selects the production endpoints listed in §2 when `DUITKU_ENV=production`. It uses HMAC-SHA256 for Create Invoice, payment-method probe, transaction status and callback validation.

Prior read-only diagnostics reported:
- production payment-method probe: HTTP 403 `Invalid Signature` for the tested signature variants;
- production transaction-status probe: HTTP 401 `Wrong signature` (including a deliberately invalid signature);
- an empty/invalid Create Invoice request returned a merchant-related error.

These responses are diagnostic evidence only. They do **not** establish that the owner's credentials are sandbox credentials, nor do they independently prove the merchant account is inactive. A malformed or incomplete request, incorrect signature construction, wrong project/key pairing, merchant project state, or endpoint-specific expectations can produce authentication/configuration failures.

Owner's authoritative instruction remains that the supplied credentials are LIVE/PRODUCTION. Do not relabel them as sandbox. Diagnose the actual production request against the current official POP/API documentation and preserve redacted request metadata for comparison. Never log the key or complete signature.

## 9. Safe diagnostic sequence

1. Read current repository adapter and tests before changing code.
2. Confirm `DUITKU_ENV=production` in production runtime and confirm the exact production URLs in §2.
3. Confirm the Cloudflare secrets are present without printing their values.
4. Confirm merchant code and API key came from the same LIVE project in the merchant portal; do not request that the key be pasted into chat.
5. Compare exact HTTP method, content type, header names, JSON body shape, timestamp milliseconds, Jakarta datetime formatting, HMAC input concatenation, lowercase hex output, and amount representation with official docs.
6. Perform only the read-only production `getpaymentmethod` probe with a valid non-transactional request.
7. Do not use an empty Create Invoice request as a credential test; it is not a valid invoice request.
8. Do not create a real invoice during signature debugging.
9. If read-only auth succeeds, run a production readiness review and obtain explicit owner approval before a small-value live transaction.
10. After approved test payment, verify POP UI, server callback, transaction-status check, idempotent settlement, admin reconciliation, and receipt/event records.
11. Only after owner approval, enable `DUITKU_CHECKOUT_ENABLED=true` and deploy.
12. Record exact commit, deployment, test evidence, transaction approval and outcome without recording secrets.

## 10. Go-live acceptance

- LIVE credentials are stored in production secrets and never exposed.
- All production endpoint/signature probes pass.
- Callback endpoint is publicly reachable and returns expected responses.
- Callback HMAC, amount, order mapping, transaction-status verification and idempotency pass.
- Duplicate callback and provider timeout/retry tests pass.
- Customer browser events cannot settle payments.
- Admin reconciliation is protected and audited.
- One small real payment has been explicitly approved and verified end-to-end.
- Owner explicitly approves enabling checkout.
- Checkout remains OFF until every item above is complete.

## 11. Official references

- Duitku POP API reference: https://docs.duitku.com/pop/id/
- Duitku general API reference (payment methods and transaction status): https://docs.duitku.com/api/id/
- Duitku merchant portal: https://passport.duitku.com/

Recheck the official references before any production code change because provider documentation and endpoints can change.
