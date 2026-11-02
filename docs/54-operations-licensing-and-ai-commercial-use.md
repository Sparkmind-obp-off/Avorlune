# 54 — Business operations, licensing registry & AI commercial use

Status (2026-11-02): **IMPLEMENTED · TESTED (12 integration tests) · DEPLOYED** (migration `0004_operations.sql` applied to production).

## 1. Step-up re-authentication (docs/48 §5)
`POST /admin/auth/reauth` (password) opens a 10-minute window (`sessions.reauth_at`; a fresh login also counts). Required for: manual payment confirmation, export, access-link revocation, Duitku reconcile, refund resolution. API answers `403 REAUTH_REQUIRED`; the admin UI prompts and retries once.

## 2. Manual refund workflow
`refunds` table. `POST /admin/projects/:id/refunds` (request; amount ≤ payment − processed − open requests) → `POST …/refunds/:refundId/resolve` (step-up; `processed` requires a provider/bank reference, `rejected` requires a note). Payment becomes `refunded` once processed refunds cover it. Money moves outside the app (Duitku portal / bank). Duitku refund API: NOT integrated.

## 3. Notification outbox
`notifications` table, dedupe key per project+event+key, no contact copy. Events: project_submitted, quote_sent, quote_accepted, payment_pending/success/failed, production_started, ready_for_review, revision_requested, final_delivered, refund_processed/rejected. Email via Resend only when `NOTIFY_EMAIL_ENABLED=true` + `RESEND_API_KEY` + `NOTIFY_FROM_EMAIL` (not configured — no provider claimed). Until then admin sends manually and marks `manual_sent`. Retry with backoff, 5 attempts, failure tracking.

## 4. Asset licensing registry + delivery gate
`providers` (seeded: genspark — commercial_use `restricted`, api_available `no`, terms read 2026-11-02) and `asset_licenses` (source type, provider, reference, generation notes, source material, licence name/evidence, commercial use, restrictions, QA). `delivered` is refused unless the approved final asset has a QA-approved record with commercial use `allowed` + evidence; any `not_allowed` record blocks delivery.

## 5. Support tickets
Customer `POST /projects/:ref/support` (token, 5/h). Admin list/resolve; resolution note is shown to the customer.

## 6. Admin dashboard
`GET /admin/dashboard`: counts, revenue, refunds, open items, configuration flags (never values).

## 7. AI output commercial use — research (official sources, read 2026-11-02)
| Question | Finding | Source |
|---|---|---|
| May Genspark outputs be used commercially, incl. for clients? | Yes, "for internal, personal, or commercial purposes, including on behalf of or for the benefit of third parties", subject to plan. Help Center: commercial use (client work, deliverables, websites, advertising) is included in Plus/Pro/Team/Enterprise for content created during an active subscription; guaranteed through 2027-06-30. | genspark.ai/terms (2026-04-02); genspark.ai/helpcenter/membership-plans |
| Can we buy many credits and resell them / resell access? | **No.** Account may not be shared, transferred or sold; reselling access or powering third-party services is prohibited; automated extraction prohibited. Selling a human-directed production *service* that delivers outputs is permitted. | same |
| Conditions | Acknowledge source / do not misrepresent origin when republishing; no third-party rights granted (model providers, OSS); user bears IP-infringement risk and indemnifies Genspark; terms may change (commercial use may be limited to paid tiers). | genspark.ai/terms |
| Copyright in Indonesia | Creator must be a human (UU 28/2014); purely AI-generated works not protected and not recorded by DJKI; AI-assisted works with significant human intellectual contribution may be protected; RUU Hak Cipta in preparation. | DJKI, 26 May 2026 |
| Copyright in the US | Protected only where a human determined sufficient expressive elements; prompts alone insufficient. | U.S. Copyright Office, Part 2 (Jan 2025) |

Consequences implemented: public page `/ai-licensing`, updated `/terms` and `/privacy`, `/refund-policy`, `/pricing` (no invented prices); delivery gate requires subscription evidence; no promise of exclusive copyright. Owner action: record the active Genspark plan tier and keep invoices as evidence. Legal pages remain DRAFT pending counsel review.
