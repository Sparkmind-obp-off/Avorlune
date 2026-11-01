# AVORLUNE — Two Pages Deployments & Shared API Runbook

**Status:** Target deployment design; not yet deployed  
**Repository:** `Sparkmind-obp-off/Avorlune`  
**Branch:** `main`

## 1. Deployment target

Exactly two frontend deployments and one backend API service:

| Service | Cloudflare product | Responsibility |
|---|---|---|
| Customer frontend | Pages project `avorlune` | Public site and customer workspace |
| Admin frontend | Pages project `avorlune-admin` | Private operations dashboard |
| API | One Worker + Hono | Shared server-side business logic |
| Database | Existing D1 `avorlune-production` | Shared production system of record |
| File storage | One private R2 bucket | Private customer and production assets |

The current deployment is a single Pages project with the admin UI under `/admin` and API routes in Pages Functions. Splitting deployments requires a deliberate migration of API hosting/routing. Do not assume the Worker API exists until deployed and smoke-tested.

## 2. Suggested monorepo layout

Target layout (adapt to actual repository; do not blindly move files):

```text
apps/
  customer/        # customer frontend build
  admin/           # admin frontend build
server/
  api/             # Hono Worker entrypoint and routes
shared/            # shared schemas, types, UI primitives
migrations/        # additive D1 migrations
scripts/
docs/
```

If the existing Vite app is not yet separated, split routes/build entrypoints incrementally. Preserve existing URLs and customer flows during migration. Avoid a wholesale rewrite.

## 3. Pages project configuration

Customer Pages project:
- Project name: `avorlune`
- Root directory: `apps/customer` once migration is complete (current root may remain during transition).
- Production branch: `main`
- Customer Clerk public key may be exposed only as a frontend publishable key.
- Never include Clerk secret keys, admin credentials, Duitku API key, or R2 credentials in frontend build variables.

Admin Pages project:
- Project name: `avorlune-admin`
- Root directory: `apps/admin` once migration is complete.
- Production branch: `main`
- No Clerk configuration or Clerk SDK is required for admin login.
- Admin auth happens through the shared API using secure cookies.
- Do not configure public preview deployments with production secrets or production D1 access.

Build settings and root directories must be validated against the actual package scripts before creating the project.

## 4. Shared API

Deploy one Hono API Worker independently of either frontend. It owns:
- Clerk customer token verification.
- First-party admin session verification.
- Authorization and project ownership.
- D1 reads/writes.
- Private R2 operations.
- Duitku LIVE server-side integration and callback verification.
- Audit events, rate limits, and idempotency.

CORS should allow only the exact deployed customer and admin origins. Cookie-authenticated admin mutations require CSRF and exact Origin checks. If admin and API use different registrable domains, cookie strategy must be explicitly reviewed; prefer same-site subdomains under the same parent domain.

## 5. D1 safety

- Keep the existing `avorlune-production` database.
- Never delete, recreate, or empty production D1 as part of this deployment split.
- Inspect current schema, migrations, bindings, and environment stamp before applying changes.
- Use additive migrations and a Time Travel bookmark before production migrations.
- Do not create a second production database unless explicitly approved.
- Preview deployments must not access production D1.

## 6. R2

One private production bucket is a REQUIRED dependency for customer upload, private preview, final-asset approval and customer delivery. The target is one private bucket named `avorlune-assets`, bound as `DELIVERY_BUCKET`. It is not active yet. Provisioning may require billing and therefore requires explicit owner approval. Until the bucket is provisioned and tested, private delivery and final-asset approval remain blocked/fail-closed; use the manual fallback in docs/41 and docs/44.

- No public bucket domain.
- Random opaque object keys; do not use customer names/emails in keys.
- File type and magic-byte allowlist; size limits.
- Server-side ownership/role checks on every operation.
- Short-lived presigned URLs only when required; prefer API-mediated downloads where current code already uses them.
- Audit upload/download/revoke.
- Do not activate R2 billing or create a bucket without approval.
- Activation checklist, lifecycle, security, quota and pricing: `docs/51-cloudflare-r2-production-storage-spec.md`.

Public portfolio images remain in frontend static assets until a separate public bucket is justified.

## 7. Migration sequence

1. Inventory current repository, build scripts, Pages Functions, routes, and tests.
2. Document existing customer/admin paths and API contracts.
3. Extract shared server API from Pages Functions into a Worker entrypoint without changing behavior.
4. Deploy API to a non-production/isolated environment and run contract tests.
5. Create separate customer and admin frontend entrypoints/builds in the monorepo.
6. Deploy admin Pages project without linking it from customer pages.
7. Configure exact CORS origins, API base URLs, and secure cookies.
8. Configure Clerk for customer only and test customer ownership checks.
9. Test first-party admin auth independently of Clerk.
10. Switch production traffic only after all smoke tests pass.
11. Preserve rollback path to current single Pages deployment until cutover is accepted.

## 8. Release acceptance

- Exactly two frontend Pages projects exist and deploy independently.
- API Worker serves customer and admin APIs.
- Customer frontend has no admin route, link, menu, or Clerk admin role.
- Admin frontend has no Clerk dependency.
- Both frontends use the same API and D1.
- Admin API rejects customer credentials.
- Customer API enforces project ownership.
- CORS, cookies, CSRF, and preview isolation are tested.
- Existing inquiry, customer portal, quote, payment, approval, and manual operations flows remain intact.
- Duitku checkout remains disabled until LIVE auth verification is complete.
- R2 is required before private delivery can go live; it remains unprovisioned until owner approves billing. Follow docs/51.

## 9. Current-state warning

The repository README currently documents one Pages project (`avorlune`) with the admin at `/admin` and API under Pages Functions. The split described here is a target architecture, not a claim that separate Pages projects or a standalone Worker API have already been created. Implementation must begin with a fresh repository audit.
