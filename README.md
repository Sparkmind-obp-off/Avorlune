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

The approved target is **exactly two frontend applications**, in one repository:
1. **Customer frontend** — Clerk authentication for customers only.
2. **Admin frontend** — separate Cloudflare Pages deployment with first-party AVORLUNE admin authentication. No Clerk, no public registration, and no admin login link/menu on the customer frontend.

Both frontends will use one shared backend API, one production D1 database, and (after owner approval) one private R2 bucket. The API is a backend service, not a third frontend.

Proposed future URLs (not yet configured):
- Customer: `avorlune.com` (current fallback: `avorlune.pages.dev`)
- Admin: `admin.avorlune.com` (temporary Pages fallback: `avorlune-admin.pages.dev`)
- API: `api.avorlune.com` (only after the shared Worker API is deployed and verified)

Architecture and implementation documents:
- `docs/47-two-frontend-authentication-architecture.md`
- `docs/48-admin-authentication-and-security-spec.md`
- `docs/49-two-pages-deployments-and-shared-api-runbook.md`
- `docs/50-customer-auth-migration-and-acceptance-plan.md`

**Important:** This is the approved target architecture, not a claim that the two Pages projects, Clerk customer auth, or standalone Worker API have already been implemented. Current production remains the single Pages deployment described below until a tested migration is completed.

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
| Duitku POP payment | Checkout from the customer portal (amount from accepted quote, invoice reuse, 60-min expiry), signed callback + amount check + server-to-server status before settling once → `queued`; admin gateway status probe (masked), order list, reconcile. **Deployed with checkout OFF; credentials rejected by Duitku production — owner verification pending (`docs/46`).** |
| Tests | 88 Vitest tests (unit + API integration on a SQLite-backed D1 shim + in-memory R2 stand-in). `npm audit --omit=dev`: 0 vulnerabilities. |

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
