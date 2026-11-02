# 64 — Data Model, API and Acceptance Criteria

**Status:** Target technical specification, not a claim that these entities/endpoints already exist.

## Design rules

Inspect current schema/routes first. Reuse and extend existing inquiries, projects, quotes, payment_orders, callbacks, refunds, support, licensing, and audit records. Prefer additive migrations. Keep project and payment state machines separate. Derive amounts from accepted quote snapshots on the server. Use integer minor currency units and explicit currency.

## Logical entities

Existing structures may cover these; do not duplicate:
- Services: id, slug, title, category, description, active, version, pricing mode, configuration schema, terms version.
- Inquiry/brief: reference, customer/contact, service snapshot, structured brief, rights declaration, consent version, status, timestamps.
- Quote: project, version, status, immutable scope snapshot, total, currency, expiry, acceptance.
- Payment schedule: quote, currency, total, aggregate status.
- Payment milestones: schedule, deposit/balance type, sequence, amount, due date, status.
- Payment orders: gateway, milestone relation, merchant order ID, amount, status, expiry, provider reference.
- Payment ledger: immutable settlement/refund/credit/adjustment entries.
- Production tasks: project, stage, operator, provider, planned/actual cost, status.
- Asset provenance: source/generated/preview/final type, license, QA and delivery eligibility.

Extend existing payment_orders with compatibility for legacy single-payment orders; preserve existing references and unique constraints.

## Project lifecycle

Suggested states: inquiry, needs_clarification, qualified, quoted, awaiting_deposit, queued, in_production, quality_review, preview_ready, revision_in_progress, awaiting_balance, final_ready, delivered, completed, cancelled, on_hold.

Map existing values carefully. Do not rename production values without compatibility migration and regression tests.

## Payment lifecycle

Milestone: unpaid, pending, paid, failed, expired, cancelled, partially_refunded, refunded.

Schedule: unpaid, partially_paid, paid, partially_refunded, refunded, disputed.

Payment state is never a proxy for project state.

## API capabilities

Customer: list services; create/update draft brief; submit brief; read own project/quote/schedule; accept/decline quote; create checkout for currently due milestone; refresh payment; submit preview feedback/revision; read/download authorized assets; open support ticket.

Admin: triage/clarify brief; create/send/supersede quote; inspect schedule/attempts; reconcile Duitku LIVE; record audited manual payment/refund; create production tasks; update milestones; approve assets; release delivery after gates; review costs/audit.

Names are illustrative; adapt to existing route conventions.

## Critical invariants

1. Brief submission creates no invoice or production task.
2. Quote acceptance freezes scope and creates payment schedule.
3. Verified deposit is required before production queue.
4. Deposit and balance are separate milestones.
5. Partial payment is never shown as fully paid.
6. Verified balance is required before final delivery.
7. License/provenance and human QA required before final release.
8. Customer can access only their own project/assets.
9. Financial admin overrides require step-up auth and audit.
10. Callback is server-verified, idempotent, and amount-bound.
11. Preview cannot access production D1 or payment secrets.
12. Legacy payment records remain readable and auditable.

## Test matrix

Test brief idempotency, rights declaration, quote expiry/supersession, deposit tampering, invoice reuse, failed/expired deposit, duplicate/out-of-order callbacks, partial aggregation, balance payment, manual payment evidence, partial/full refund ledger, delivery blocked before balance, delivery blocked without QA/license, cross-customer access, missing R2 fail-closed, preview isolation, and legacy payment regressions.

## Rollout

Schema discovery → additive migration/backfill plan → domain calculations/tests → schedule API/admin → customer UI → mocked Duitku tests → backup review → production migration → LIVE read-only authentication → explicit owner approval for real payment → explicit approval to enable checkout.

Definition of done requires code, migration, tests, UI, authorization, observability, docs, and deployment evidence to agree.
