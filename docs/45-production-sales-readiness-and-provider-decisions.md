# AVORLUNE — Production & Sales Readiness Assessment

**Assessment date:** 2026-11-01  
**Repository baseline reviewed:** `main`, reported application commits `d37b09b`, `cad1491`, `4c3c788`  
**Purpose:** Define what remains before AVORLUNE can safely accept and fulfil real paid orders.  

> **Decision superseded:** Earlier references in this historical assessment to DOKU/Midtrans as candidate gateways and sandbox-first payment integration are obsolete. The owner's current decision is Duitku POP LIVE/PRODUCTION only. Follow `docs/46` and `docs/52`. R2 is a required private-delivery dependency; follow `docs/51`.  
**Important:** This is a repository/documentation and provider-research assessment. It is not an independent Cloudflare dashboard audit, deployed penetration test, legal opinion, merchant approval, or proof that a provider account is active.

---

## 1. Executive decision

The latest README and execution log describe a materially stronger application than the original audit. Preview is fail-closed, final approval is coupled to a specific final asset, authentication/session controls have been strengthened, cost tracking exists, and a private R2 delivery adapter has been coded.

However, AVORLUNE is **not yet ready for unrestricted paid production**. It is an operational application with important live dependencies and commercial operations still unfinished.

The user's target is not a demo or temporary pilot. The target is a sellable service that can accept a paid order, confirm payment reliably, produce work under documented rights, deliver it privately, handle revisions/refunds/support, and recover from operational failures.

### Release status based on the current evidence

- Application foundation: substantially implemented (repository-reported).
- Preview safety: no D1/R2 in preview, fail-closed; dedicated preview database remains unavailable.
- Final approval logic: implemented and covered by local tests (repository-reported).
- Private delivery: code implemented, **not activated** because production R2 is not provisioned.
- Payment gateway: **not implemented**; manual payment confirmation only.
- Legal/customer contract: Privacy and Terms remain DRAFT.
- Monitoring, production restore drill, notification workflow, stock/provider licensing process: incomplete.
- Sales validation and portfolio: not evidenced.

**Decision: NO-GO for public paid launch today.** The project can progress toward a controlled first paid order only after the blocking gates in §7 are completed. Do not call the service production-ready merely because the Pages site is live.

---

## 2. What is already present (per current README and execution log)

1. Public service pages, inquiry intake, quote workflow, customer project link, admin inbox, project status, feedback, manual payment record, and audit trail.
2. Preview environment has no database or R2 binding; API fails closed without a database. Production D1 is stamped with the production environment marker.
3. Final approval requires a particular active final asset from the same project and records the approved asset ID; delivery rechecks the object.
4. Private R2 upload/list/download/revoke code exists with a 25 MB cap, file signature allowlist, random object keys, header-based customer authorization, no-store response, and audit events.
5. Authentication/session hardening, rate limits, logout-all, log redaction, bounded export, and project cost ledger are described.
6. Local backup/restore with synthetic data was reportedly verified; production restore was not tested.
7. Local check reportedly passes 72 tests; live smoke tests were recorded for preview and production.

These are **reported results from README/docs/39**, not independent verification in this assessment.

---

## 3. Remaining gaps — launch blockers

### P0 — Must be completed before accepting ordinary customer payments

| ID | Gap | Why it blocks sales | Required completion evidence |
|---|---|---|---|
| P0.1 | R2 private delivery not activated | The customer portal cannot provide the actual final asset through the intended private delivery flow. | Owner-approved billing; private bucket bound only to production; upload/download/revoke tested end-to-end with real browser session; customer isolation and expiry tests; no public bucket. |
| P0.2 | No payment gateway | The app records manual payment; there is no automated checkout, webhook reconciliation, expiry, refund, or settlement lifecycle. | One provider approved and onboarded; server-side payment creation; verified webhook; status inquiry/reconciliation; idempotency; duplicate/out-of-order event tests; refund and failed/expired payment tests. |
| P0.3 | Privacy and Terms are DRAFT | Customer data and paid-service terms cannot safely be presented as final contractual terms. | Final Indonesian-language privacy notice, terms/service agreement, AI disclosure, client asset warranty, license/usage rights, revision scope, delivery, cancellation/refund, complaint, retention/deletion, vendor disclosures; owner approval and qualified Indonesian legal review. |
| P0.4 | No final live paid-order rehearsal | Individual features passing tests does not prove the complete paid customer lifecycle. | A full test-mode journey from inquiry → quote → checkout → verified payment → production → review → revision → final asset → customer approval → delivery → invoice/receipt → support/refund path. Record exact deployed commit and evidence. |
| P0.5 | No reliable customer notification workflow | Customers may not receive quote, payment, status, expiry, revision, and delivery updates. | At minimum, an owned manual SLA and message log; preferably a transactional email provider with retries, delivery status, idempotency, and privacy-safe templates. Do not claim automation until live-tested. |

### P1 — Must be resolved before declaring stable production

| ID | Gap | Required completion |
|---|---|---|
| P1.1 | Production backup/restore not tested | Restore a current production backup into an isolated database; compare row counts/checksums; document RPO/RTO and recovery owner. Never test restore over production. |
| P1.2 | Dedicated preview D1 unavailable | Resolve account's D1 database limit by inventorying unused databases and requesting explicit approval before deleting any, or choose a paid plan. Preview must never inherit production DB/secrets. |
| P1.3 | Monitoring and alerts absent | Add uptime/health, 5xx, webhook failure, upload/download failure, queue/notification failure, and storage usage alerts. Alert without exposing personal data or tokens. |
| P1.4 | Refund, cancellation, dispute, and chargeback operations not fully evidenced | Define states, authority, evidence, reconciliation, partial refunds, duplicate payments, expired quotes, failed jobs, and customer communications. |
| P1.5 | Legal/business identity and tax/invoicing workflow | Confirm the contracting entity/name, invoice/receipt fields, tax treatment, payment settlement account, complaint contact, and accounting reconciliation with qualified local advice. |
| P1.6 | Live security retest incomplete | Test customer-link authorization and R2 flows on a non-production environment; review CSP, CORS/origin, referrer policy, session invalidation, webhook verification, rate limits, dependency update process. |
| P1.7 | Staff/owner operating procedure | Establish owner on-call, daily order/payment reconciliation, support response window, backup check, incident escalation, access recovery, and handover. Single-admin mode is acceptable for launch if controlled. |

### P2 — Commercial readiness (not necessarily technical launch blockers)

- Define one initial buyer segment and a small number of service packages with clear deliverables, duration, revision count, usage rights, and exclusions.
- Replace placeholder/hypothesis pricing with actual cost-based pricing and margin guardrails.
- Prepare at least 3–5 rights-cleared portfolio samples; if unavailable, launch with an honest no-portfolio position and a tightly scoped first-order offer.
- Track tool/model, version, prompt/brief, human creative contribution, source asset, stock license, and delivery evidence for each order.
- Add a per-order production checklist and QA sign-off.
- Publish real contact/support details and realistic turnaround expectations.
- Verify AVORLUNE brand/domain/social/trademark status before investing heavily in public acquisition.
- Establish a customer feedback, repeat-order, and complaint-resolution loop.

---

## 4. Payment gateway recommendation

### Recommended shortlist

**Primary candidate: DOKU. Backup candidate: Midtrans. Xendit: additional alternative if merchant onboarding or digital-service classification is better suited.**

Do not integrate two gateways at launch. Pick one after merchant onboarding and fee confirmation.

| Provider | Public pricing snapshot | Strengths | Questions to resolve |
|---|---|---|---|
| DOKU | QRIS listed at 0.7%; VA generally Rp4,000 (BCA Rp4,500); cards 2.8% + Rp2,000; no setup/monthly fee shown; prices exclude VAT. | Broad payment methods; payment link; checkout integration; webhook/payment notifications; useful for a service business. | Confirm merchant eligibility, service/digital creative classification, settlement schedule, refund/chargeback fees, exact API product, required legal entity/KYC, and whether any minimums or additional platform fees apply. |
| Midtrans | QRIS listed at 0.7%; VA Rp4,000; cards 2.9% + Rp2,000; some e-wallet fees vary by category; public pricing excludes VAT where noted. | Clear API documentation; notifications; signature verification; idempotency support; established checkout options. | Confirm the correct pricing category for AI creative production/digital services, merchant approval, settlement/refund rules, and exact fees. |
| Xendit | QRIS listed at 0.63%; VA generally Rp4,000; cards 2.9% + Rp2,000; e-wallet fees can differ for digital content; pricing excludes tax. | Broad API and payment method coverage; webhooks and payment status flows. | Digital content/service classification may change rates; obtain written quote and confirm merchant eligibility and payout schedule. |

### Why DOKU first

DOKU is a sensible first integration candidate because its published pricing states no setup/monthly fee, charges on successful transactions, lists QRIS/VA/card/e-wallet options, offers payment links, and supports checkout integration and webhook notifications. This fits the first stage without forcing AVORLUNE to maintain multiple providers.

However, do not assume the public fee table is the final fee for AVORLUNE. Obtain written confirmation for the actual merchant entity and service category before committing.

### Payment architecture requirements

Build a provider-neutral adapter, but implement only one provider initially:

- `PaymentProvider.createCheckout(order)`
- `PaymentProvider.verifyWebhook(request)`
- `PaymentProvider.getPaymentStatus(providerReference)`
- `PaymentProvider.requestRefund(payment, amount, reason)` (only if the provider supports the required flow)
- Persist internal order/payment ID, provider reference, expected amount, currency, status, expiry, paid/settled timestamps, and audit trail.
- Never accept payment success from a browser redirect or frontend request.
- Verify provider webhook signatures using the provider's documented algorithm and secret.
- Validate merchant/order reference, amount, currency, transaction status, and fraud status where relevant.
- Handle duplicate and out-of-order webhooks idempotently.
- Verify ambiguous events by calling the provider's server-side status API.
- Use immutable payment event records; do not overwrite the only evidence of a prior state.
- Do not start production until the defined deposit/full-payment threshold is confirmed by the backend.
- Define how partial payments, deposits, overpayments, expired invoices, refunds, chargebacks, and manual reconciliation work.
- Keep provider secret keys only in Cloudflare secrets; never in browser code, D1 plaintext, logs, or Git.
- Ensure paid state cannot be manually set by customers or by a spoofed callback.

**Important:** because AVORLUNE sells a creative service rather than a generic physical product, confirm the provider's merchant category and prohibited/restricted business rules during onboarding. The provider must explicitly accept the business model.

---

## 5. Stock and creative asset provider recommendation

Stock assets are not the main product; AVORLUNE sells finished creative production. Use stock only as a licensed ingredient in a transformed final work. Do not resell or hand over stock source files as standalone deliverables.

### Recommended order

1. **Adobe Stock — primary paid stock candidate.** Use asset-by-asset licensing and keep the license receipt/asset ID attached to the project record. Adobe's published standard license permits broad use in creative projects, marketing, websites, and social media, and allows license transfer to a client subject to restrictions. It prohibits standalone file distribution. Check whether a particular asset needs an Enhanced/Extended license, and verify music-specific terms separately.
2. **Pexels — supplementary no-cost source.** Suitable for selected background footage/images where its license and model/property releases fit the project. Do not redistribute content standalone, compile a competing stock service, or use its API/content to train AI models. Do not promise exclusivity or ownership of source assets.
3. **Envato Elements — do not make the default provider until written clarification.** Its current license is project-based and supports many commercial client uses, but it explicitly restricts use in on-demand services and redistribution of source files. Because AVORLUNE is a service-led, on-demand creative production business, obtain written confirmation that the intended AVORLUNE workflow is permitted before using it for client work.

### Asset provenance record (required per order)

- Provider and asset URL/ID.
- License type, purchase/download date, account/subscription status.
- Invoice/receipt or license certificate.
- Project/client to which the asset is assigned.
- Whether the asset is editorial-only, has model/property restrictions, or contains identifiable trademarks.
- Whether the asset is music, footage, font, template, image, or SFX and any category-specific license.
- Final output where it was used and whether the client may publish/advertise it.
- Any restrictions communicated to the client.
- Never store or deliver unlicensed stock source files as if owned by AVORLUNE or the client.

### AI production provider gate

No provider should be selected only because its web app works. Before integrating an image/video API, verify:
- official API access is available for the actual account;
- commercial-use terms cover paid client output;
- rights/indemnity and restrictions are understood;
- customer prompts, references, faces, and uploaded files are handled appropriately;
- retention/training policy is acceptable;
- pricing, rate limits, failure/retry, and regional availability are known;
- outputs can be stored and delivered privately;
- human review and safety checks are included.

For the first production release, manual generation through an authorized UI can be acceptable if it is documented, licensed, and human-reviewed. Do not advertise automated generation or instant turnaround if it is not actually implemented.

---

## 6. Infrastructure and cost decisions

### Cloudflare R2

The current R2 standard storage price page (checked 2026-11-01) lists:
- 10 GB-month standard storage included per month;
- 1 million Class A operations included;
- 10 million Class B operations included;
- egress free;
- beyond the included allowance: standard storage USD 0.015/GB-month, Class A USD 4.50/million, Class B USD 0.36/million.

This makes R2 a reasonable first private-delivery candidate for a small launch, but the account may still require billing setup/payment method. The free allowance is not a guarantee that the account can activate the service without a payment method or that every associated Cloudflare feature is free. Confirm account-specific billing and set budget alerts/usage checks before activation.

**Recommendation:** approve R2 Standard for production-only private delivery with a conservative usage policy, file size cap already in code, lifecycle/deletion policy, and monthly review. Do not use Infrequent Access for active client delivery without understanding retrieval fees and 30-day minimum storage duration.

### D1 preview

Cloudflare's current D1 limits page lists 10 databases per account on Free and up to 1,000,000 on Workers Paid; the reported account has reached its current Free database limit. Before upgrading:
- inventory every D1 database and identify owner/project/last-used timestamp;
- verify no production, active app, backup, or integration depends on candidates;
- only delete an unused database with explicit owner approval;
- otherwise evaluate the actual Workers Paid plan cost and whether the preview database is worth it.
- Until then, keep preview without any DB and use isolated local tests for DB behavior. Do not reconnect preview to production.

### Other spend

- Payment gateway: no monthly/setup fee is advertised by the shortlisted public pricing pages, but transaction fees and VAT apply; confirm in merchant contract.
- Stock: pay per asset/subscription only when required by a paid project and after license fit is confirmed.
- Email provider: start with an approved transactional email provider only after volume/price/data processing terms are checked; manual contact is an interim fallback.
- Monitoring: start with platform-native metrics and low-volume checks before adding paid SaaS.

---

## 7. Production release gates — definition of “ready to sell”

### Gate A — paid-order capable (must pass before first ordinary customer order)

- [ ] Production R2 private bucket provisioned and bound; bucket is not public.
- [ ] Private asset upload, customer listing, authorized download, revoke, expiry, and deletion tested on deployed production-like environment.
- [ ] Payment gateway merchant account approved and production credentials configured as secrets.
- [ ] Checkout creation, webhook verification, status reconciliation, idempotency, expiry, refund, and duplicate callback tests pass.
- [ ] Backend payment state is authoritative; browser redirect cannot mark an order paid.
- [ ] Privacy Policy, Terms, service scope, client rights/licensing, AI disclosure, refunds/cancellations, retention, and complaint process approved and published.
- [ ] Full end-to-end test order completed with payment provider sandbox and a controlled real low-value transaction if required/approved.
- [ ] Quote clearly specifies deliverables, resolution/format, duration, revisions, turnaround, usage rights, payment terms, and exclusions.
- [ ] Customer receives reliable confirmation and delivery/support instructions.
- [ ] Production backup and restore evidence exists; no restore is performed on production.
- [ ] Monitoring and incident escalation are active.
- [ ] Admin/operator can reconcile payments and handle failed, duplicate, expired, refunded, or disputed transactions.
- [ ] A rights-cleared sample portfolio or an honest launch-without-portfolio strategy is ready.
- [ ] Public claims and package prices match actual tested capability.

### Gate B — stable production operation

- [ ] Dedicated non-production D1 and R2 resources or an equivalent fully isolated test environment.
- [ ] Production restore drill completed into a separate database.
- [ ] Security retest completed for customer links, private files, auth, webhook, export, CORS/CSP, and rate limits.
- [ ] Email notifications and support SLA are operating.
- [ ] Monthly cost/margin, stock licenses, refunds, and provider invoices are reconciled.
- [ ] Incident, access revocation, secret rotation, data deletion, and customer complaint procedures have named owners.

### Gate C — public launch and scaling

- [ ] Market segment, service offer, turnaround, and pricing validated by real buyer behavior.
- [ ] Repeatable creative QA and production capacity measured.
- [ ] Staff access/least privilege implemented if more than one operator needs access.
- [ ] Portfolio and case studies are rights-cleared and factual.
- [ ] Brand/domain/trademark review completed to the degree claimed publicly.
- [ ] Capacity limits, support response targets, and outage communication are published.
- [ ] Legal/accounting review covers the actual business entity and sales workflow.

**Do not describe Gate A, B, or C as passed until every applicable item has recorded evidence.**

---

## 8. Recommended execution sequence

1. **Owner decisions:** approve R2 billing setup and choose the payment gateway onboarding candidate (DOKU first, Midtrans backup). This does not authorize any paid stock subscription.
2. **R2 activation:** provision production-only bucket, configure `DELIVERY_BUCKET`, test private delivery, and verify the final approval path end-to-end.
3. **Payment integration:** inspect current payment schema/routes and implement the provider adapter, webhook, reconciliation, refunds, idempotency, and admin payment timeline. Use sandbox first.
4. **Legal and order contract:** finalize the customer-facing policies and quote/service agreement with local professional review.
5. **Notifications and monitoring:** implement the minimum reliable email + operational alerts; keep manual fallback.
6. **Production rehearsal:** execute full sandbox order and approved low-value real order; record evidence and exact commit.
7. **Commercial proof:** rights-cleared sample work, clear packages, cost/margin, support process, and initial customer validation.
8. **Production sign-off:** update docs/37, docs/39, README, and launch checklist with evidence; only then change the release status.

---

## 9. Owner decisions required

These are the only decisions that need to come from the owner before the next implementation wave:

1. **R2:** approve Cloudflare billing activation for a production-only private bucket, with usage monitoring and a conservative budget cap. No bucket has been activated by this assessment.
2. **Payment gateway:** allow DOKU merchant onboarding and sandbox integration as the first candidate, with Midtrans as backup if DOKU does not approve the business model or has unsuitable fees. No merchant account or payment credential is assumed.
3. **Stock assets:** no subscription required at this stage. Use original work first; license Adobe Stock assets per paid project only when needed. Do not use Envato Elements for client service delivery until the on-demand-service restriction is clarified in writing.
4. **Preview D1:** approve inventory review only; do not delete databases or upgrade Cloudflare until the account inventory and exact cost are known.
5. **Legal:** approve sending the final policies and service agreement for qualified Indonesian legal review.

---

## 10. Sources checked

Provider and platform terms/pricing can change. Recheck at merchant onboarding and before each purchase.

- DOKU pricing: https://www.doku.com/harga
- DOKU webhook/payment notifications: https://docs.doku.com/get-started/manage-business/set-up-integration/webhook-payment-notification
- DOKU Checkout notifications: https://docs.doku.com/accept-payments/integration-tools/doku-checkout/configure-notifications
- Midtrans pricing: https://midtrans.com/pricing
- Midtrans webhook verification and transaction status: https://docs.midtrans.com/docs/https-notification-webhooks
- Midtrans idempotency: https://docs.midtrans.com/reference/api-headers
- Xendit Indonesia pricing: https://help.xendit.co/hc/id/articles/360039086452-Bagaimana-rincian-biaya-untuk-produk-Xendit
- Adobe Stock licensing: https://stock.adobe.com/license-terms
- Adobe Stock usage/licensing FAQ: https://helpx.adobe.com/id_id/stock/web/common-questions/usage-licensing.html
- Envato Elements license: https://help.elements.envato.com/hc/en-us/articles/360000628966-Envato-Elements-License
- Pexels Terms: https://help.pexels.com/hc/en-us/articles/900005880463-What-are-the-Terms-and-Conditions
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Cloudflare D1 limits: https://developers.cloudflare.com/d1/platform/limits/

---

## Final recommendation

The fastest responsible route to a sellable AVORLUNE is **not** to add every possible provider or build a large automation stack. It is to complete one trustworthy commercial path:

**DOKU (or Midtrans if onboarding/fees are better) → verified paid order → human-reviewed production → private R2 delivery → customer approval/revision → final receipt/support.**

For creative assets, start with original production and a documented Adobe Stock per-project license when a stock ingredient is genuinely needed. Keep Envato on hold pending written clarification, and use Pexels only within its restrictions.

Until the P0 gates pass, the correct release label remains **NO-GO for public paid production**.
