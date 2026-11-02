# AVORLUNE — Two-Frontend Architecture & Authentication Decision

**Status:** Approved architecture decision (implementation pending)  
**Date:** 2026-11-01  
**Scope:** Customer frontend, admin frontend, shared API, authentication boundary, data and asset access.

## 1. Decision

AVORLUNE will use exactly two frontend applications:

1. **Customer frontend** — public-facing website and customer workspace. Clerk is the customer identity provider.
2. **Admin frontend** — private operational dashboard. Admin authentication is owned and operated by AVORLUNE using its own credentials and server-side session system. Clerk is not used for admin authentication.

Both frontends live in one GitHub repository and deploy independently. They share one backend API and one production D1 database. R2 is a backend storage service and is not a frontend.

No third frontend is planned.

## 2. Domain and deployment model

Proposed production domains (not yet configured):
- Customer: `avorlune.com` (current Pages fallback: `avorlune.pages.dev`)
- Admin: `admin.avorlune.com` (separate Pages project; temporary fallback: `avorlune-admin.pages.dev`)
- API: one Worker service, preferably `api.avorlune.com` when custom domain setup is approved.

The customer and admin Pages projects may use the same repository and `main` branch with different root directories/build commands. Deployments must be independently configured and verified. The API is a separate backend deployment, not a third frontend.

## 3. High-level topology

```text
                 One GitHub repository (main)
                   /                    \
          Customer app                Admin app
          Cloudflare Pages            Cloudflare Pages
          Clerk customer auth         AVORLUNE admin auth
                   \                    /
                    \                  /
                    Shared API (Worker + Hono)
                              |
                  ---------------------------
                  |                         |
              D1 database              Private R2
                  |
          Duitku LIVE integration
```

## 4. Authentication boundaries

### Customer
- Clerk is used only for customer-facing identity and sessions.
- Public pages may be browsed without signing in where appropriate.
- Customer account functions require a verified Clerk session.
- The backend verifies Clerk-issued tokens; it must not trust frontend role flags or user IDs.
- Customer records are mapped to an internal stable user ID.
- A customer can only access their own projects, orders, feedback, and deliverables.
- Existing signed project-link access must remain supported during migration until a tested migration plan explicitly replaces it.

### Admin
- Admin uses a separate first-party authentication implementation and credentials.
- No Clerk admin account, Clerk organization, or Clerk role is used.
- No admin sign-up or self-service registration exists.
- No admin login link, button, menu, or route is exposed by the customer frontend.
- Admin login exists only inside the separate admin deployment.
- Initial owner account is provisioned through deployment secrets/controlled setup, never public registration.
- The current single-admin PBKDF2 password-hash and secure session approach is the starting implementation to preserve and harden.

## 5. Authorization

Authentication establishes identity; authorization is enforced on every API request.

- Customer endpoints require a valid customer identity or an explicitly supported signed project token.
- Admin endpoints require a valid admin session and CSRF validation for state-changing cookie-authenticated requests.
- Admin sessions and customer tokens are distinct formats, signing keys, cookies, audiences, and validation paths.
- Customer tokens must never satisfy admin middleware.
- Clerk customer tokens must never satisfy admin middleware.
- Admin session cookies must be host-only, HttpOnly, Secure, SameSite=Strict, and scoped to the admin host where possible.
- No wildcard CORS. Allow only the exact customer and admin origins required.
- API responses must not disclose admin configuration or secrets.

## 6. Data and storage

- One D1 database remains the system of record.
- One private R2 bucket is sufficient for the first release.
- Public marketing images remain in the customer frontend static assets until a public asset bucket is justified.
- Private customer uploads, working files, previews, and deliverables are stored in private R2 after owner approval to activate billing.
- Private object access is mediated by the API after checking customer ownership or admin permission.
- No private R2 bucket public access or public custom domain.

## 7. Payment

- Duitku POP JS remains the selected payment integration and is LIVE-only per owner decision.
- Customer checkout stays disabled until production authentication/configuration is verified.
- Admin can inspect and reconcile payment records through protected admin endpoints.
- No sandbox credential substitution and no real charge for authentication diagnostics.

## 8. Non-goals

- No separate admin database.
- No separate customer API.
- No third frontend for assets or API.
- No Supabase/Firebase migration solely for authentication.
- No multi-staff RBAC until the owner requests it.
- No paid infrastructure activation without explicit owner approval.

## 9. Acceptance criteria

- Customer and admin are independently deployed Pages projects.
- Customer UI contains no admin login affordance or admin registration route.
- Admin frontend is not linked from public navigation or customer UI.
- Clerk authenticates customers only.
- Admin login works without Clerk and without a public registration path.
- API enforces customer/admin boundaries server-side.
- Customer tokens cannot call admin endpoints; admin cookies cannot access customer-owned data without authorization.
- CORS, CSRF, cookie scope, rate limits, audit logging, and session revocation are tested.
- Existing customer project-link flow remains functional until a separately approved migration.
- Existing Duitku LIVE safety gates remain unchanged.


## 10. Owner decision update — 2026-11-03

The owner now requests **no AVORLUNE in-app admin login screen**. This supersedes the admin login-form UX in sections 1, 4 and 9. The customer frontend remains Clerk customer-only. No admin sign-up or public registration exists.

This is a UX decision, not permission to expose CRM data. Keep the existing admin authentication until a private network/perimeter policy protects the admin frontend and every admin API route and passes allow/deny tests. If perimeter access itself requires identity verification, it is perimeter-level access rather than an AVORLUNE app login. If the owner requires absolutely no identity or network restriction, only a read-only synthetic demo is safe; real CRM and mutation routes must remain unavailable. See docs/70.
