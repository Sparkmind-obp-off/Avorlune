# AVORLUNE
### AI Creative Production

AVORLUNE is an AI-assisted creative production studio for businesses, creators, and brands that need high-quality visual content without building an in-house production team.

**Initial services**
- AI video production
- AI image production
- Campaign and social-media creative assets

**Product strategy:** start as a service-led production platform. Customers submit a brief, the team scopes and produces the work with a human-in-the-loop workflow, and customers receive approved deliverables. Do not position the customer-facing product as an AI model company or generic AI SaaS.

> Brand status: working name. Domain, social handles, and trademark clearance remain subject to direct verification. No legal clearance is claimed.

## URLs
- **Production (Cloudflare Pages, BYOK):** https://avorlune.pages.dev
- **Admin studio:** https://avorlune.pages.dev/admin
- **API base:** https://avorlune.pages.dev/api/v1
- **GitHub:** https://github.com/Sparkmind-obp-off/Avorlune

## Implementation status (verified 2026-10-31)

### Done
| Area | What exists |
|---|---|
| Public site | Home, Services (+ detail per service), Work (honest empty state), How it works, About, Start a Project, Contact, Privacy (draft), Terms (draft), 404. Responsive, keyboard accessible, reduced-motion aware. |
| Inquiry pipeline | Guided brief form with progressive disclosure; client + server zod validation; consent + rights confirmation; honeypot + minimum fill time; per-IP D1 rate limit (IPs hashed); `Idempotency-Key` dedupe; non-sequential reference `AVL-XXXX-XXXX`; audit event. |
| Admin | Login from Cloudflare secrets (PBKDF2), hashed session in D1, `HttpOnly; Secure; SameSite=Strict` cookie, CSRF token + same-origin check. Inbox with status filter, search, pagination. Project detail: brief, quotes (draft/sent), manual payment confirmation, server-enforced status transitions, internal notes, audit history, JSON export. |
| Lifecycle rules | Transition table from `docs/07`; `quoted` requires a sent quote; `queued` requires confirmed payment **or** a written exception reason; `cancelled`/admin-set `approved` require a reason; atomic compare-and-set + audit event in one D1 batch (stale writes are rejected). |
| Customer view | `/p/:reference#t=<token>` — HMAC-signed, 30-day, revocable token (token is moved out of the URL into sessionStorage). Customer can see status/timeline/quote, accept or reject a sent quote, submit consolidated feedback (revision round counted against included rounds), and approve. |
| Security headers | CSP, HSTS, X-Frame-Options DENY, nosniff, no-referrer on customer links, `noindex` on `/admin` and `/p/*`. API responses are `no-store`. |
| Tests | 42 Vitest tests: domain rules, crypto/token, and API integration against a real SQLite-backed D1 shim (auth, CSRF, cross-project isolation, revocation, rate limit, idempotency, docs/15 end-to-end scenario, concurrent transition). |

### Not yet implemented (deliberately deferred)
- **File upload / private asset delivery (R2).** No R2 bucket created yet: R2 requires enabling it on the Cloudflare account (payment method on file) — needs explicit owner approval. Previews/finals are currently shared through an external private channel; the portal records feedback and approval.
- **Notifications** (email/WhatsApp). No provider chosen; confirmation copy says so truthfully.
- **Payment gateway.** Only manual payment confirmation by an admin (actor + timestamp recorded).
- **Multiple staff accounts / roles.** One admin from secrets; `producer` role exists in schema only.
- **AI provider adapters.** None — by design until API, pricing, data policy and commercial rights are verified (`docs/08`).
- **Portfolio items.** Empty until rights-cleared samples exist.
- Retention/deletion automation, backups runbook, final legal copy (see `docs/14`).

## API (summary)
Public: `GET /health`, `GET /services`, `GET /portfolio`, `POST /inquiries`
Customer (header `x-project-token`): `GET /projects/:reference`, `POST /projects/:reference/quote/decision`, `POST /projects/:reference/feedback`, `POST /projects/:reference/approval`
Admin (session cookie + `x-csrf-token`): `POST /admin/auth/login`, `GET /admin/auth/me`, `POST /admin/auth/logout`, `GET /admin/projects`, `GET /admin/projects/:id`, `PATCH /admin/projects/:id/status`, `POST /admin/projects/:id/quotes`, `POST /admin/projects/:id/payments/confirm`, `POST /admin/projects/:id/events`, `POST /admin/projects/:id/access-link[?revokePrevious=true]`, `GET /admin/projects/:id/export`

Responses: `{ data, requestId }` or `{ error: { code, message, details? }, requestId }`.

## Data architecture
- **Cloudflare D1** `avorlune-production` — tables: `users`, `projects`, `quotes`, `payments`, `assets` (schema only), `feedback`, `project_events`, plus operational `sessions`, `rate_limits`, `idempotency_keys`. Migration: `migrations/0001_initial_schema.sql`.
- Money is stored as integer IDR (`amount_minor`). Audit metadata never contains contact details, brief text or tokens.

## Admin usage guide
1. Sign in at `/admin`.
2. Open a new inquiry → move to **Kualifikasi**.
3. Create and **send** a quote (deliverables, revisions, ETA, usage notes) → move to **Penawaran dikirim**.
4. **Buat tautan** → send the private link to the customer via your normal channel.
5. Customer accepts → record payment (**Catat konfirmasi manual**) → **Antrean produksi** → **Produksi** → **Review internal** → **Review klien**.
6. Customer sends feedback (→ **Revisi**) or approves (→ **Disetujui**) → mark **Terkirim** after final files are actually delivered.
7. Use **Cabut & buat baru** to revoke a leaked link.

## Repository layout
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
npm run db:migrate:local
npm run build && npx wrangler pages dev dist --ip 0.0.0.0 --port 3000
npm run check                              # typecheck + lint + tests
```

## Deployment (BYOK Cloudflare Pages)
- Pages project: `avorlune` (production branch `main`). D1 binding `DB` → `avorlune-production`.
- Secrets (set with `wrangler pages secret put … --project-name avorlune`): `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `LINK_SIGNING_SECRET`. Rotating `LINK_SIGNING_SECRET` invalidates all customer links.
- Deploy: `npm run db:migrate:prod && npm run deploy`.
- Preview deployments share the production D1 binding today — **do not use preview URLs with real customer data** until a separate preview database is configured (`docs/05`).

## Principles
1. Validate demand before paying for infrastructure or API usage.
2. Keep a human approval gate before delivery.
3. Never expose provider keys or private production assets to the browser.
4. Keep provider integrations behind adapters; never assume a tool has a usable API or commercial-use rights.
5. Build the smallest useful product and measure paid demand, turnaround time, quality and repeat orders.

## Repository map (docs)
`docs/01` business & brand · `02` PRD · `03` metrics · `04` UX · `05` architecture · `06` data model · `07` API contract · `08` AI workflow · `09` security · `10` roadmap · `11` backlog · `12` decisions & risks · `13` handoff · `14` launch checklist · `15` test strategy · `16` operations · `MASTER-SYSTEM-PROMPT.md`

## Status
Portal MVP (Milestones 1–4 of `docs/13`, plus customer feedback/approval from Milestone 5) is deployed. **Not launch-ready for real paid customers** until `docs/14` blockers are resolved: brand/trademark screening, final privacy/terms, retention policy, private asset delivery, notification channel, separate preview database.
