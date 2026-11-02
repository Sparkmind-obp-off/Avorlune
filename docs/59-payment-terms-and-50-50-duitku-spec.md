# 59 — Payment Terms and 50/50 Duitku Specification

**Status:** Approved default commercial model; implementation required.  
**Gateway:** Duitku LIVE/PRODUCTION only.

## 1. Decision

For custom creative projects:
- 50% deposit after quote acceptance and before production.
- 50% balance after preview and included revisions, before final unwatermarked delivery.

The deposit is an advance payment for the agreed service, not a purchase of AI credits. Do not claim deposits are automatically forfeited; cancellation/refund depends on reviewed terms, work performed, costs properly incurred, and applicable law.

Standardized ready-to-order services may use 100% upfront only when scope, price, delivery, revisions, and terms are fully disclosed. This is an exception; custom project default remains 50/50.

## 2. Milestones

**Deposit:** 50% of accepted total, calculated server-side in integer minor units. It reserves capacity and authorizes production start. Unpaid/failed/expired deposit means no production queue.

**Balance:** remaining 50%, due after production, revisions, and final QA when preview is ready. Verified balance is required before final delivery.

An approved change order must preserve the original quote and transparently recalculate outstanding amounts.

## 3. Duitku LIVE rule

Owner-supplied credentials are LIVE/PRODUCTION. Never route them to sandbox, label them sandbox, or use sandbox results to diagnose production. Follow docs/46 and docs/52 for exact production endpoints and endpoint-specific signatures.

Checkout remains OFF until read-only LIVE authentication succeeds and owner explicitly approves activation. Do not create invoices or real charges during signature debugging. A real payment test requires separate explicit owner approval.

## 4. Logical payment model

One accepted quote has one schedule and multiple milestones. Each milestone may have payment attempts, but only one successful settlement satisfies that milestone.

Suggested logical entities:
- payment_schedules: quote, currency, total, aggregate status.
- payment_milestones: schedule, type (deposit/balance), sequence, amount, due date, status.
- payment_orders: gateway, milestone, merchant order ID, amount, status, expiry, provider reference.
- payment_callbacks: minimized event metadata, signature validity, processing state.
- payment_ledger: immutable settlement/refund/adjustment entries.

Do not assume these tables exist. Inspect current schema and extend existing payment_orders safely. Preserve legacy single-payment orders.

## 5. States

Milestone: unpaid, pending, paid, failed, expired, cancelled, partially_refunded, refunded.

Schedule aggregate: unpaid, partially_paid, paid, partially_refunded, refunded, disputed.

Project status is independent. A project may be in production while payment is partially paid.

## 6. Server-side invariants

- Amount comes only from accepted quote/payment schedule.
- Client cannot choose amount, currency, or milestone.
- Unique merchant order ID tied to one milestone.
- Reuse only valid pending invoice for same milestone.
- Deposit settlement is idempotent and queues production exactly once.
- Balance settlement never queues production again.
- Final delivery blocked until balance, QA, licensing, and authorization pass.
- Verify callback signature, merchant, order, amount, and server-side transaction status.
- Browser callbacks/redirects are informational only.
- Duplicate/out-of-order callbacks cannot double-settle.
- Refund is a separate ledger event; never delete payment history.
- Manual reconciliation is step-up authenticated and audited.

## 7. Customer/admin UX

Customer sees total accepted price, deposit due, amount received, remaining balance, next trigger, payment status, and receipt/reference. Do not show provider credentials or internal AI credit usage.

Admin can inspect schedule, create/retry valid attempts, reconcile Duitku, record evidenced manual payment, record refund/adjustment, and view callback/audit history. No silent editing of settled amounts.

## 8. Refunds

Follow docs/63. Duitku refund automation is not assumed available. Until verified and authorized, refunds remain manual through the merchant portal and recorded with evidence. Do not mark complete without evidence of money movement.

## 9. Safe rollout

1. Inspect current payment code, schema, migrations, and tests.
2. Design additive changes compatible with existing orders.
3. Backfill legacy records as single-milestone schedules without changing amount/status.
4. Implement schedule calculations, milestone checkout, API, UI, and audit.
5. Test mocked provider responses, partial payment, duplicate callbacks, retries, expiry, refunds, and delivery gates.
6. Keep checkout disabled until LIVE auth verified and owner approves.
7. Run a real low-value LIVE transaction only after separate owner approval.

## 10. Acceptance criteria

Custom quote creates 50/50 milestones; deposit alone starts production; balance is required for final delivery; partial payment is never shown as fully paid; callbacks are idempotent; legacy records remain intact; UI matches server calculations; mocked tests are never represented as real transactions.
