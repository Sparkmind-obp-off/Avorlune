# 80 — Unified Platform Implementation & Gap Register (2026-11-03)

Implements docs/77–79 (Phases 1–5 of docs/78) on the existing Hono + D1 + React stack. Migration `0005_customers_catalog_actions.sql` (additive).

## 1. Delivered
| Area | Implementation | Evidence |
|---|---|---|
| Customer auth (Clerk **Development**) | `server/lib/clerk.ts`: manual RS256 JWT verify vs JWKS (kid, iss from publishable key, `azp` ∈ `CLERK_AUTHORIZED_PARTIES`, exp/nbf ±5 s, `sub` format, `sts≠pending`); pk_test refused when `APP_ENV=production`. `sub` → internal `customers.id`; email is an attribute only (never ownership). Publishable key served at runtime by `GET /api/v1/account/config`. | `tests/integration/customer-platform.test.ts` |
| Account | `/account/me`, onboarding skip/complete, server draft (`/account/me/draft`), `/account/me/projects` (scoped by customer_id). Legacy HMAC project links still work; no auto-claim by email. | same |
| Guest brief preservation | sessionStorage draft `avl_brief_draft` + account draft sync; `offerSlug` binds the brief to the current offer version. `CUSTOMER_AUTH_REQUIRED_FOR_BRIEF` (default off). | same |
| Unified catalog | `catalog_categories` / `catalog_items` / `offers` / immutable `offer_versions`. Public `GET /catalog`, `/catalog/:slug`; admin new-version + status. Seeds are all `quote_required` (no invented prices). Fixed/starting_at needs `pricingEvidence`. | same |
| 50% DP + 50% pelunasan | `payment_milestones` created on quote acceptance (deposit = ceil(total/2)). Deposit gates `queued`; balance gates `delivered` and final-file download (`BALANCE_REQUIRED`). Duitku checkout and manual confirm pay the next milestone only. | payments/api/operations tests |
| Action services | `action_runs` + steps; state machine with max 3 retries; customer authorization required for external side effects; staff cannot self-authorize; public/internal step visibility. | same |
| CRM / customer 360 | Bounded search (reference / id / exact email / name prefix), 360 view, notes, tags, `admin_audit`. | same |
| Admin UI | Schedule panel, action-runs panel, prefilled manual amount = next milestone; pages **Pelanggan** and **Katalog**. | typecheck |
| Public demo | `/demo` fully client-side synthetic data, labelled DEMO. | — |
| Environments | Preview bound to its own D1 `avorlune-preview` (4cdfb666-…), migrated 0001–0005, stamped `preview`. Production has no Clerk vars. | config test |

## 2. Remaining gaps / approvals
| Gap | Status | Owner action |
|---|---|---|
| Duitku API key ≠ merchant code | BLOCKED — checkout OFF | Re-copy key from Duitku dashboard |
| Clerk production instance | Not started (by design) | Approve production instance, domain, keys |
| `CLERK_SECRET_KEY` on preview | Not set (optional; only used to fetch verified email) | Optional |
| R2 private delivery | Disabled | Approve R2 billing |
| Email (Resend) | Disabled (outbox + manual send) | Approve provider |
| Legal pages | DRAFT | Legal review |
| Automated action execution | Manual human-in-the-loop only | Out of scope |
| Bundle code-splitting (~520 kB JS) | Warning only | Later |
