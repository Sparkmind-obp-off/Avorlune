# 56 — Customer Journey and Order Lifecycle

**Status:** Approved target journey.  
**Default custom-project payment:** 50% deposit + 50% balance.

## Journey

1. Discover services and rights-cleared examples.
2. Choose Ready-to-order or Custom project.
3. Build and submit a brief for free.
4. AVORLUNE reviews feasibility, rights, capacity, and missing details.
5. AVORLUNE issues a versioned quotation.
6. Customer accepts the exact scope and terms.
7. Customer pays the 50% deposit.
8. Server verifies payment; project enters the production queue.
9. AVORLUNE produces and performs internal human quality review.
10. Customer receives protected preview and submits included revisions.
11. AVORLUNE completes revisions and final QA.
12. Customer pays the remaining 50%.
13. Server verifies balance; final assets are released privately.
14. Project is completed and support remains available.

## Discovery and brief

Service pages explain purpose, outputs, inputs, formats, revisions, estimated timing, limitations, and price/quotation mode. Brief submission is free and does not reserve capacity or authorize production.

Collect only necessary details: objective, audience, service, outputs, quantity, dimensions/duration, format, platform, style, references, brand guidelines, source materials, deadline, usage context, optional budget, contact, consent, and rights declaration.

Warn customers not to upload confidential or third-party material without authorization.

## Review and quotation

Admin can mark a brief new, needs clarification, qualified, declined, quoted, or expired. A quotation states scope, deliverables, exclusions, price, taxes/fees if applicable, schedule, revision allowance, payment schedule, cancellation/refund terms, usage rights, customer dependencies, and expiry.

No production starts from a brief alone.

## Deposit and production gate

Customer acceptance freezes an immutable scope snapshot. Custom work defaults to 50% deposit and 50% balance. Production starts only after deposit is verified through Duitku server-side settlement or the existing audited manual-payment process. A screenshot or browser redirect is not proof of payment.

## Preview and revisions

Preview may be watermarked, reduced resolution, or otherwise protected. It is for review and is not the final deliverable. The quotation defines revision rounds. Changes to concept, quantity, format, or scope require a change request and potentially a new quote.

## Balance and delivery

After revisions and final QA, issue the remaining balance. Release final unwatermarked deliverables only after verified balance, license/provenance checks, human QA, and authorized approval. Log delivery and provide a manifest.

## Exceptions

- Incomplete brief: save draft; no invoice.
- Infeasible request: explain and close or suggest alternative.
- Expired quote: revalidate.
- Deposit failed/expired: do not queue production.
- Provider unavailable: pause and communicate.
- Out-of-scope revision: quote before work.
- Balance unpaid: retain protected preview; do not release final.
- R2 unavailable: use approved secure manual fallback; no public bucket URLs.

## State separation

Project lifecycle and payment lifecycle are independent. A project can be in production while payment is partially paid. Do not use one status field for both.

Ready-to-order services may use 100% upfront only when scope, price, delivery, and terms are fixed and disclosed.
