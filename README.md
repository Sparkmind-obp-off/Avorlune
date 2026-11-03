# AVORLUNE
### AI Creative Production

AVORLUNE is an AI-assisted creative production studio for businesses, creators, and brands that need high-quality visual content without building an in-house production team.

**Initial services**
- AI video production
- AI image production
- Campaign and social-media creative assets

**Product strategy:** start as a service-led production platform. Customers submit a brief, the team scopes and produces the work with a human-in-the-loop workflow, and customers receive approved deliverables. Do not position the customer-facing product as an AI model company or generic AI SaaS.

> Brand status: working name. Domain, social handles, and trademark clearance remain subject to direct verification. No legal clearance is claimed.

## Current URLs
- **Production (Cloudflare Pages, BYOK):** https://avorlune.pages.dev
- **Current admin path:** https://avorlune.pages.dev/admin
- **Current API base:** https://avorlune.pages.dev/api/v1
- **GitHub:** https://github.com/Sparkmind-obp-off/Avorlune

## Target frontend and authentication architecture

The approved target is **two separate frontend applications in two separate repositories**, sharing one authoritative backend/API and one operational D1 database:

1. **Customer/Public frontend** — maintained in this repository; customer authentication is Clerk-targeted, subject to the migration and verification gates below.
2. **Private Admin/Super Admin frontend** — maintained in https://github.com/Sparkmind-obp-off/Admin-overlune; separate Cloudflare Pages deployment and first-party Admin authentication/perimeter. No Clerk customer identity, public Admin registration or Admin login link/menu on the customer frontend.

The current backend/API baseline remains in this Public repository. Admin-overlune must call it over authenticated HTTPS and must not create a second business API, D1 database or operational data store. A dedicated Cloudflare Worker/API extraction is an optional later refactor, only after a tested, backward-compatible migration. Neither frontend may access D1, R2 or provider secrets directly.

Private R2 is a required dependency before customer file upload/private delivery can go live; the bucket is not yet provisioned and activation awaits owner approval.

Proposed future URLs (not yet configured):
- Customer: `avorlune.com` (current fallback: `avorlune.pages.dev`)
- Admin: `admin.avorlune.com` (temporary Pages fallback: `avorlune-admin.pages.dev`)
- API: `api.avorlune.com` (only after the shared API deployment is migrated and verified)

Architecture and implementation documents:
- `docs/47-two-frontend-authentication-architecture.md`
- `docs/48-admin-authentication-and-security-spec.md`
- `docs/49-two-pages-deployments-and-shared-api-runbook.md`
- `docs/50-customer-auth-migration-and-acceptance-plan.md`
- `docs/51-cloudflare-r2-production-storage-spec.md`
- `docs/52-duitku-live-production-endpoints-and-operations.md`
- `docs/53-external-provider-and-operations-register.md`
- `docs/54-unified-public-admin-and-external-capability-contract.md`

**Important:** This is the approved target architecture, not a claim that both frontend deployments, Clerk customer auth, private R2 or an extracted Worker API have already been implemented. Current production remains the existing deployment described below until a tested migration is completed. Existing Public /admin functionality is a legacy migration surface and must not be removed until Admin-overlune is ready and rollback is verified.

## Implementation status (verified 2026-11-01)

**Release status:** Gate 0 (controlled pilot) **conditional** on owner approvals · Gate 1/2 **NO-GO**. Details: `docs/37` §10, evidence: `docs/39`.

### Done
| Area | What exists |
|---|---|
| Public site | Home, Services (+ detail), Work (honest empty state), How it works, About, Start a Project, Contact, Privacy & Terms (**DRAFT**), 404. Responsive, accessible, reduced-motion aware. |
| Inquiry pipeline | Client + server zod validation; consent + rights confirmation; honeypot + min fill time; D1 rate limit (hashed IPs, trusted `cf-connecting-ip` only); `Idempotency-Key`; reference `AVL-XXXX-XXXX`; audit event. |
| Admin (single-admin mode) | Login from Cloudflare secrets (PBKDF2); hashed session bound to the credential fingerprint (rotation revokes all sessions); `HttpOnly; Secure; SameSite=Strict`; CSRF + Origin + Sec-Fetch-Site checks; layered login throttling (IP/account/global); **Keluar semua**. Inbox, quotes, manual payment, guarded status transitions, internal notes, audit history, cost ledger, bounded + audited JSON export. |
| Final approval invariant | Customer and staff approval require a specific active **final** asset of the same project whose private object exists; `approved_asset_id` recorded; `delivered` re-checks. **Disabled while no private bucket is bound.** |
| Private delivery (code) | Upload/list/download/revoke behind an R2 binding `DELIVERY_BUCKET` — magic-byte allowlist, 25 MB cap, random keys, header-auth download, `private, no-store`, audit. **Not live: R2 not provisioned (owner approval pending).** |
| Environment isolation | Preview deployments have no D1/R2 binding; runtime guard requires `app_meta.environment == APP_ENV`; static config test. Verified live (preview API → 503). |
| Customer view | `/p/:reference#t=<token>` — HMAC-signed, 30-day, revocable; status, timeline, quote decision, consolidated feedback, private file list/download and final approval (when delivery is enabled). |
| Duitku POP payment | Checkout from the customer portal (amount from accepted quote, invoice reuse, 60-min expiry), signed callback + amount check + server-to-server status before settling once → `queued`; admin gateway status probe (masked), order list, reconcile. **Deployed with checkout OFF; LIVE production authentication diagnostics remain unresolved. Owner confirms supplied credentials are LIVE/PRODUCTION; errors do not mean they are sandbox. See `docs/46` and `docs/52`.** |
| Business operations | Step-up re-auth for sensitive admin actions; manual refund workflow; notification outbox (manual send until email provider approved); asset licensing/provenance registry with delivery gate; support tickets; admin dashboard (`docs/54`). |
| Legal pages (DRAFT) | `/terms`, `/privacy`, `/ai-licensing` (AI commercial use + copyright, official sources), `/refund-policy`, `/pricing` (quote-based, no invented prices). |
| Tests | 100 Vitest tests (unit + API integration on a SQLite-backed D1 shim + in-memory R2 stand-in). `npm audit --omit=dev`: 0 vulnerabilities. |

### Not yet implemented / blocked
- **Two separate frontend deployments and shared Worker API** — approved target architecture; current admin still lives under `/admin` in the customer Pages deployment.
- **Clerk customer authentication** — designed in docs 47 and 50; not yet integrated. Existing signed project-link flow must remain compatible during migration.
- **Separate admin frontend deployment** — designed; existing first-party single-admin auth is the baseline and must remain independent of Clerk.
- **R2 private delivery live** — needs owner approval (R2 billing). Interim manual private delivery: `docs/41`.
- **Dedicated preview D1** — account D1 limit reached; preview runs without a DB (`docs/40`).
- **Legal approval** — Privacy/Terms are drafts pending owner + Indonesian counsel review.
- **Duitku live checkout** — credentials not accepted by Duitku production; `DUITKU_CHECKOUT_ENABLED=false` (`docs/46`). Manual payment path `docs/44` remains.
- Notifications, refund automation — manual procedure `docs/44`.
- Production restore drill — local synthetic restore verified (`docs/42`).
- Multi-staff accounts, AI provider adapters, research/Apify module, portfolio, validated pricing, brand clearance.

### Runbooks
`docs/40` environment isolation · `docs/41` private delivery & approval · `docs/42` backup & restore · `docs/43` secrets & incidents · `docs/44` manual operations & staff access · `docs/46` Duitku payment integration · `docs/47–50` two-frontend, customer/admin auth, deployment and migration.

## API (current implementation summary)
Public: `GET /health`, `GET /services`, `GET /portfolio`, `POST /inquiries`  
Customer (header `x-project-token`): `GET /projects/:reference`, `GET /projects/:reference/assets/:assetId/download`, `POST /projects/:reference/quote/decision`, `POST /projects/:reference/feedback`, `POST /projects/:reference/approval` (body `{ assetId }`), `POST /projects/:reference/payments/checkout`, `POST /projects/:reference/payments/:orderId/refresh`  
Payment gateway: `POST /payments/duitku/callback` (form-urlencoded, Duitku signature)  
Admin (session cookie + `x-csrf-token`): `POST /admin/auth/login`, `GET /admin/auth/me`, `POST /admin/auth/logout`, `POST /admin/auth/logout-all`, `POST /admin/projects/:id/assets?kind=`, `GET /admin/projects/:id/assets/:assetId/download`, `POST /admin/projects/:id/assets/:assetId/revoke`, `POST /admin/projects/:id/costs`, `GET /admin/projects`, `GET /admin/projects/:id`, `PATCH /admin/projects/:id/status`, `POST /admin/projects/:id/quotes`, `POST /admin/projects/:id/payments/confirm`, `POST /admin/projects/:id/events`, `POST /admin/projects/:id/access-link[?revokePrevious=true]`, `GET /admin/projects/:id/export`, `GET /admin/payments/duitku/status`, `GET /admin/projects/:id/payment-orders`, `POST /admin/projects/:id/payment-orders/:orderId/reconcile`

Responses: `{ data, requestId }` or `{ error: { code, message, details? }, requestId }`.

## Data architecture
- **Cloudflare D1** `avorlune-production` (stamped `app_meta.environment=production`) — tables: `users`, `projects`, `quotes`, `payments`, `assets` (schema only), `feedback`, `project_events`, plus operational `sessions`, `rate_limits`, `idempotency_keys`, `app_meta`, `project_costs`. Migrations: `0001_initial_schema.sql`, `0002_gap_closure.sql`, `0003_payments_duitku.sql` (`payment_orders`, `payment_callbacks`) — all additive.
- Money is stored as integer IDR (`amount_minor`). Audit metadata never contains contact details, brief text or tokens.

## Admin usage guide (current deployment only)
1. Sign in at `/admin`.
2. Open a new inquiry → move to **Kualifikasi**.
3. Create and **send** a quote (deliverables, revisions, ETA, usage notes) → move to **Penawaran dikirim**.
4. **Buat tautan** → send the private link to the customer via your normal channel.
5. Customer accepts → record payment (**Catat konfirmasi manual**) → **Antrean produksi** → **Produksi** → **Review internal** → **Review klien**.
6. Customer sends feedback (→ **Revisi**) or approves (→ **Disetujui**) → mark **Terkirim** after final files are actually delivered.
7. Use **Cabut & buat baru** to revoke a leaked link.

## Repository layout (current)
```
src/            React + Vite + TS frontend (pages, admin studio, styles)
server/         Hono API: app, routes (public/customer/admin), domain, middleware, lib
shared/         Domain rules + zod schemas + catalogue shared by client and server
functions/api/  Cloudflare Pages Functions entry ([[path]].ts → Hono)
migrations/     D1 SQL migrations
tests/          unit + integration (node:sqlite D1 shim)
scripts/        hash-password.mjs (generate ADMIN_PASSWORD_HASH)
docs/           Product, architecture and operations blueprint
```

## Local development
```bash
npm install
cp .dev.vars.example .dev.vars            # then fill values
node scripts/hash-password.mjs '<min 12 chars>'   # → ADMIN_PASSWORD_HASH
npm run db:migrate:local && npm run db:stamp:local
npm run build && npx wrangler pages dev dist --ip 0.0.0.0 --port 3000
npm run check                              # typecheck + lint + tests
```

## Deployment (current BYOK Cloudflare Pages)
- Pages project: `avorlune` (production branch `main`). D1 binding `DB` → `avorlune-production`.
- Secrets (set with `wrangler pages secret put … --project-name avorlune`): `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `LINK_SIGNING_SECRET`. Rotating `LINK_SIGNING_SECRET` invalidates all customer links.
- Deploy: `npm run db:bookmark:prod && npm run db:migrate:prod && npm run deploy` (deploy runs `npm run check` first).
- Preview deployments are isolated: no database binding (API returns 503) — see `docs/40`.
- Before each production migration record a Time Travel bookmark (`npm run db:bookmark:prod`).

## Principles
1. Validate demand before paying for infrastructure or API usage.
2. Keep a human approval gate before delivery.
3. Never expose provider keys or private production assets to the browser.
4. Keep provider integrations behind adapters; never assume a tool has a usable API or commercial-use rights.
5. Build the smallest useful product and measure paid demand, turnaround time, quality and repeat orders.

## Status
Gap-closure work (docs/38) applied 2026-11-01: G0.2 and G0.3 closed, G0.1 code-complete but not live. **Not launch-ready for unrestricted production.** See `docs/37` §10 and `docs/39`.


## Product and commercial model (approved target)

AVORLUNE's approved business model is a **service-led semi-marketplace for AI Creative Production**. It resembles a specialist freelance-service marketplace in the customer journey, but AVORLUNE does not hire or assign independent freelancers as its fulfilment model. AVORLUNE produces with authorized AI tools (initially Genspark) plus human creative direction, QA, and delivery. Customers buy creative services and agreed deliverables—not AI credits, account access, or subscriptions.

**Custom project payment default: 50% deposit after quotation acceptance and before production; 50% balance after preview/revisions and before final unwatermarked delivery.** Brief submission is free and does not create an invoice or production commitment. All paid services use the same 50% deposit before production and 50% balance before final delivery.

Product and operational specifications:
- [55 — Service-led semi-marketplace product strategy](docs/55-service-led-semi-marketplace-product-strategy.md)
- [56 — Customer journey and order lifecycle](docs/56-customer-journey-and-order-lifecycle.md)
- [57 — Service catalog and brief builder](docs/57-service-catalog-and-brief-builder.md)
- [58 — Quotation, scope and change control](docs/58-quotation-scope-and-change-control.md)
- [59 — Payment terms and 50/50 Duitku specification](docs/59-payment-terms-and-50-50-duitku-spec.md)
- [60 — AI production and asset delivery operations](docs/60-ai-production-and-asset-delivery-operations.md)
- [61 — Customer/admin UX and notifications](docs/61-customer-admin-ux-and-notification-spec.md)
- [62 — Pricing, unit economics and capacity](docs/62-pricing-unit-economics-and-capacity.md)
- [63 — Customer policy and contract requirements](docs/63-customer-policy-and-contract-requirements.md)
- [64 — Data model, API and acceptance criteria](docs/64-data-model-api-and-acceptance-criteria.md)
- [65 — Master system prompt: product and operations](docs/65-master-system-prompt-product-and-operations.md)

These documents specify the approved target, not a claim that all corresponding application code, payment milestones, or production workflows have already been implemented. Existing payment implementation is currently single-amount/full-quote; 50/50 requires compatible backend, database, customer/admin UI, and regression-test work. Duitku remains LIVE/PRODUCTION only and checkout remains OFF until authentication verification and explicit owner approval. R2 provisioning, paid billing, real payment tests, and final legal publication remain approval-gated.


## Customer platform, CRM and demo expansion (2026-11-03)

The next approved product expansion is a full-stack customer portal and searchable customer operations workspace. Customers may browse publicly, sign in/sign up before submitting briefs or accessing private projects, skip onboarding, and continue directly to service discovery. Public demo uses synthetic data only.

New specifications:
- [66 — Customer platform product blueprint](docs/66-customer-platform-product-blueprint.md)
- [67 — Customer authentication and onboarding](docs/67-customer-auth-and-onboarding-spec.md)
- [68 — Service discovery and brief builder UX](docs/68-service-discovery-and-brief-builder-ux.md)
- [69 — Customer CRM and admin workspace](docs/69-customer-crm-and-admin-workspace.md)
- [70 — Admin no-login UX and private perimeter security](docs/70-admin-no-login-and-perimeter-security.md)
- [71 — Demo and staging isolation](docs/71-demo-and-staging-isolation-spec.md)
- [72 — Customer data model and migration](docs/72-customer-data-model-and-migration.md)
- [73 — Customer/admin API contract](docs/73-customer-and-admin-api-contract.md)
- [74 — Notifications, support and retention](docs/74-notifications-support-and-retention.md)
- [75 — Full-stack roadmap and release gates](docs/75-full-stack-roadmap-and-release-gates.md)
- [76 — Master prompt for customer platform and CRM](docs/76-master-prompt-customer-platform-and-crm.md)

**Admin access decision update:** owner requests no AVORLUNE in-app admin login screen. This supersedes the older admin login UX in docs 47–50. It does not authorize a public CRM/API. Keep existing admin protection until a private perimeter protecting both UI and API is verified. If no perimeter or identity/network restriction is acceptable, only a public read-only synthetic demo may be exposed; real customer data and mutations remain private.

**Status:** These are target specifications. They do not mean Clerk, the customer portal, CRM, demo, new API routes or the private perimeter have been implemented or deployed. Existing production architecture and payment/R2 safety gates remain unchanged.


## Unified AI Product, Creative & Action Marketplace (2026-11-03)

New approved concept and execution prompt:
- [77 — Unified marketplace concept](docs/77-unified-ai-product-creative-and-action-marketplace-concept.md): AI Creative Production, AI Creative Products and AI Action Services in one curated AVORLUNE storefront; AVORLUNE remains the sole initial provider.
- [78 — Master System Prompt: unified platform build & gap closure](docs/78-master-system-prompt-unified-platform-gap-closure.md): use this as the primary execution prompt for the complete repository, all documented gaps and implementation phases.
- [79 — Clerk Development setup and production cutover](docs/79-clerk-development-setup-and-cutover.md): customer-only Clerk Development integration and safe Production separation.

**Clerk status:** Owner reports that Development credentials have been obtained. This repository audit found no Clerk SDK dependency or Clerk middleware in the inspected current source baseline; existing customer access uses project-scoped signed links and the admin uses first-party session authentication. Clerk implementation and successful Development sign-in are therefore still pending verification. Use Development credentials only in ignored local development configuration. Never expose or commit the secret key. Production Clerk requires separate Production credentials and explicit cutover.

**Marketplace boundary:** phase 1 is a curated single-provider storefront. Catalog items, offers, offer versions, quotes, orders/projects, action runs, service logs and deliverables are separate concepts. No third-party seller/freelancer marketplace or customer-facing AI tool/credit resale.

Docs 77–79 are specifications/prompts; they do not mean the new marketplace, Clerk, catalog, action engine or CRM has been implemented or deployed. Follow docs/78 to audit and close the remaining gaps based on actual code and evidence.


## Admin repository split (owner direction, 2026-11-03)

The Admin/Super Admin frontend now has its own repository:
- **Public/customer + authoritative backend baseline:** https://github.com/Sparkmind-obp-off/Avorlune
- **Admin/Super Admin frontend:** https://github.com/Sparkmind-obp-off/Admin-overlune

This owner-directed repository split supersedes the earlier assumption in docs 47–50 that both frontend applications would live in one repository. It does **not** create a second backend or a second operational database. The Admin app must consume the authoritative AVORLUNE API through a versioned contract; it must not access D1/R2 directly or fork customer/order/payment data.

Admin repository specifications:
- [Admin README and document index](https://github.com/Sparkmind-obp-off/Admin-overlune/blob/main/README.md)
- [00 — Product and architecture blueprint](https://github.com/Sparkmind-obp-off/Admin-overlune/blob/main/docs/00-product-and-architecture-blueprint.md)
- [02 — Visual design system and screen concepts](https://github.com/Sparkmind-obp-off/Admin-overlune/blob/main/docs/02-visual-design-system-and-screen-concepts.md)
- [05 — Authentication, perimeter and security](https://github.com/Sparkmind-obp-off/Admin-overlune/blob/main/docs/05-authentication-perimeter-and-security.md)
- [06 — Public/Admin integration contract](https://github.com/Sparkmind-obp-off/Admin-overlune/blob/main/docs/06-public-admin-integration-contract.md)
- [08 — Separate payment domains](https://github.com/Sparkmind-obp-off/Admin-overlune/blob/main/docs/08-separate-payment-domains.md)
- [14 — Decision register](https://github.com/Sparkmind-obp-off/Admin-overlune/blob/main/docs/14-decision-register-and-open-questions.md)

The existing Admin security preference remains: no public admin registration and no customer Clerk-to-admin privilege inheritance. A verified private perimeter must protect both the Admin UI and every privileged API endpoint. Customer order payments remain separate from any future Admin/platform billing domain.

These documents are the agreed design baseline only. Admin frontend implementation, separate deployment, API contract changes, custom-domain configuration, and payment-domain activation remain pending their respective audits and approvals.

## Agentic Super Admin direction (2026-11-03)

The separate Admin repository is being specified as AVORLUNE's private **Agentic Super Admin Control Plane**. Its AI agent is the operational controller for approved platform and brand scopes, using a server-side orchestrator, policy engine, typed tools, durable tasks, evidence and human approval gates.

- Admin repository: https://github.com/Sparkmind-obp-off/Admin-overlune
- [Agentic Super Admin charter](https://github.com/Sparkmind-obp-off/Admin-overlune/blob/main/docs/15-agentic-super-admin-product-charter.md)
- [Agent runtime and orchestration](https://github.com/Sparkmind-obp-off/Admin-overlune/blob/main/docs/16-agent-runtime-and-orchestration-architecture.md)
- [Brand portfolio and isolation](https://github.com/Sparkmind-obp-off/Admin-overlune/blob/main/docs/18-brand-portfolio-and-tenant-isolation.md)
- [UX and screen specifications](https://github.com/Sparkmind-obp-off/Admin-overlune/blob/main/docs/20-agentic-admin-information-architecture.md)
- [Full-stack technology architecture](https://github.com/Sparkmind-obp-off/Admin-overlune/blob/main/docs/23-full-stack-technology-and-deployment-architecture.md)
- [Security and data governance](https://github.com/Sparkmind-obp-off/Admin-overlune/blob/main/docs/24-agent-security-threat-model-and-data-governance.md)

Owner clarification: there is no Admin/platform payment, subscription or billing domain. Customer order payment remains the only payment domain in the AVORLUNE product. These are design specifications, not proof of Admin or agent implementation.

### Provider profiles and video generation architecture
The Admin repository now specifies external provider profiles, optional video generation and the shared Public ↔ Admin capability control plane:
- [External provider profiles](https://github.com/Sparkmind-obp-off/Admin-overlune/blob/main/docs/28-external-provider-profiles-and-connection-governance.md)
- [Video generation pipeline](https://github.com/Sparkmind-obp-off/Admin-overlune/blob/main/docs/29-public-video-generation-and-production-pipeline.md)
- [Public ↔ Admin control contract](https://github.com/Sparkmind-obp-off/Admin-overlune/blob/main/docs/30-public-admin-control-plane-and-shared-capability-contract.md)

Video is an optional capability. Public submits customer jobs to the authoritative backend; the backend orchestrates approved providers; Admin/AI Agent configures and monitors capabilities under policy and human approval. No provider is connected or paid generation enabled merely by this design.


## Unified Public ↔ Admin architecture (owner direction)
The separate Admin/Super Admin frontend is maintained in [Admin-overlune](https://github.com/Sparkmind-obp-off/Admin-overlune). Public and Admin are separate frontends that share one authoritative backend/API and operational data source; the current backend baseline remains in this repository until a deliberate, tested extraction. Admin must not create a second database or business API. Read [the unified integration contract](docs/54-unified-public-admin-and-external-capability-contract.md), [the Admin architecture decision](https://github.com/Sparkmind-obp-off/Admin-overlune/blob/main/docs/31-unified-architecture-decision-and-lean-external-stack-policy.md), and [the unified implementation master prompt](https://github.com/Sparkmind-obp-off/Admin-overlune/blob/main/docs/32-unified-implementation-master-system-prompt.md).

External stacks (LLM, agent framework, search/research, coding assistance, chat, media generation, analytics and observability) are optional provider adapters. Add only when a concrete capability gap and verified business case exist. Video remains optional and provider activation/paid usage requires owner approval. These are architecture decisions, not claims that new runtime features or connections are already implemented.
