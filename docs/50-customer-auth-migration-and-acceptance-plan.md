# AVORLUNE — Customer Clerk Adoption & Authentication Separation Plan

**Status:** Design and migration plan  
**Rule:** Clerk customer-only; first-party AVORLUNE admin auth.

## 1. Purpose

Introduce Clerk for customer-facing identity while keeping admin credentials and sessions entirely separate. Avoid breaking the existing customer portal, which currently supports signed project links.

## 2. Customer authentication

Clerk may provide:
- Google sign-in.
- Email/password or email verification if enabled by product decision.
- Customer session management.
- Account profile and identity.

Backend responsibilities:
- Verify Clerk JWT signature, issuer, audience/authorized party, expiry, and relevant claims using a maintained verification approach.
- Map Clerk subject to an internal immutable customer user ID.
- Never accept a user ID supplied only by the browser as proof of identity.
- Enforce ownership checks on every project/order/asset operation.
- Keep Clerk secret key server-side only.
- Configure exact production callback/origin URLs.
- Avoid exposing private project data in public pages.

## 3. Existing customer access-link compatibility

Current implementation uses signed, revocable project access links (reference + token). Do not remove or invalidate this flow as part of the initial Clerk integration.

Migration options:
1. Keep signed project links as a supported guest access path.
2. Allow customers to claim/link a project after verifying their Clerk account using a controlled ownership verification process.
3. Gradually move repeat customers to account-based access.
4. Revoke or retire guest links only after explicit product decision and migration tests.

Never automatically attach a project to an account based only on matching email text unless the email is independently verified and the linking flow is secure.

## 4. Admin authentication isolation

Admin uses the first-party authentication described in `docs/48`. It must not:
- redirect to Clerk;
- accept Clerk JWTs;
- use Clerk user metadata as an admin role;
- allow customer account promotion into admin;
- expose admin registration on customer frontend.

The admin API middleware is separate from customer Clerk middleware.

## 5. Environment variables and secrets

Customer frontend:
- Clerk publishable key only (public key).
- API base URL.
- No private keys.

API Worker:
- Clerk secret key / verification configuration.
- Admin email and password hash.
- Admin session secret.
- D1 binding.
- Duitku production secrets (existing secure deployment configuration).
- R2 binding only after provisioning approval.

Admin frontend:
- API base URL only.
- No Clerk keys.
- No admin password/hash/session secret in build variables.

All secrets are configured in the relevant Cloudflare secret store, never committed to Git.

## 6. Customer-facing UX

- Public navigation contains normal customer actions only.
- Sign in / create account is clearly labeled for customers.
- No Admin label, link, route, or role selector.
- After customer login, show customer projects and account details only.
- Admin deployment is not discoverable through public navigation.
- Do not rely on obscurity as the only protection.

## 7. Test plan

### Customer
- Google sign-in succeeds in production configuration.
- Invalid/expired JWT rejected.
- Customer A cannot access Customer B's projects, orders, files, or feedback.
- Unauthenticated public pages remain accessible where intended.
- Existing signed project links continue to work during migration.
- Customer sign-out revokes or ends the session correctly.

### Admin
- Valid owner credentials can sign in at the admin deployment.
- No admin sign-up or password reset endpoint is exposed publicly.
- Clerk token rejected by admin endpoints.
- Customer project token rejected by admin endpoints.
- Invalid, expired, revoked admin session rejected.
- CSRF/Origin checks reject cross-site mutation attempts.
- Logout and logout-all revoke sessions.
- Rate limits and audit events operate as specified.

### Cross-boundary
- Customer frontend cannot discover or invoke admin login through its UI.
- Admin frontend does not load Clerk SDK or Clerk keys.
- Admin cookie is host-only and not sent to customer host.
- Customer cookies/tokens cannot satisfy admin middleware.
- CORS allows only the two known frontend origins.
- No credentials or tokens appear in logs, source maps, or build artifacts.

## 8. Rollout

1. Audit current admin auth and customer portal token model.
2. Preserve current production behavior while adding tests.
3. Build customer Clerk integration behind a feature flag.
4. Verify Clerk JWT validation and customer ownership.
5. Build/deploy separate admin frontend while retaining current admin backend protection.
6. Confirm first-party admin login works independently of Clerk.
7. Move admin API calls to the shared Worker API.
8. Remove admin UI/routes from customer build only after parity and regression tests pass.
9. Conduct security tests and owner acceptance.
10. Enable customer Clerk account features after successful migration; do not force existing customers into a broken login flow.

## 9. Go-live gates

Do not cut over if any of these fail:
- Customer Clerk token verification.
- Admin session verification independent of Clerk.
- Cross-tenant/customer ownership tests.
- CSRF/CORS/cookie tests.
- Existing customer project-link compatibility.
- Production rollback plan.
- No admin sign-up or public navigation path.


## 10. Owner decision update — 2026-11-03

Customer Clerk authentication remains the target. Onboarding is optional and skippable; public service discovery remains open. Customers authenticate before brief submission and private workspace access. Preserve guest drafts through sign-in and retain legacy signed project links during migration.

Admin UX is updated: no AVORLUNE app login screen. This supersedes the admin sign-in acceptance tests above. However, keep existing admin protection until a private perimeter is verified for both frontend and API. Customer tokens must never satisfy admin access. If no perimeter is available, do not expose real CRM data or mutations. See docs/67 and docs/70.
