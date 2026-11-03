# 79 — Clerk Development Setup & Production Cutover

**Status (2026-11-03):** Development instance configured on **preview only** (`https://preview.avorlune.pages.dev`). Frontend API host `exotic-koi-7642.clerk.accounts.dev`; publishable key (pk_test, browser-safe) in `wrangler.jsonc` env.preview and served via `/api/v1/account/config`. Server verifies tokens via JWKS (no SDK secret required). `CLERK_SECRET_KEY` is NOT stored in the repo or in production; optional for preview. Production has no Clerk configuration. Server-side verification covered by automated tests; an interactive sign-in by the owner on preview is still to be confirmed.

## 1. Scope
Clerk is for customer sign-up/sign-in only. It does not authenticate AVORLUNE admin. Public browsing remains anonymous. Customers authenticate before submitting briefs and accessing private workspace data.

## 2. Development instance
Use the Clerk Development instance already created by the owner. Do not create another instance unless the existing one is inaccessible or misconfigured.

Expected configuration concepts (confirm exact names against current official Clerk SDK docs):
- Frontend publishable key: `VITE_CLERK_PUBLISHABLE_KEY` in ignored local frontend environment file.
- Backend secret key: `CLERK_SECRET_KEY` in ignored `.dev.vars` for local Pages Functions runtime.
- Development issuer/domain and allowed origins/redirect URLs set to the actual local development origin and the configured Clerk development domain.

The publishable key is intended for frontend use. The secret key is server-only. Never prefix secret keys with `VITE_`, expose them in a response, commit them, log them or paste them into source code. Use placeholders in documentation. Confirm `.env*` and `.dev.vars` are ignored by Git before writing local values.

## 3. Runtime and token validation
Read current official Clerk documentation for the selected React SDK and Cloudflare Pages/Workers runtime before implementation. Use a maintained Clerk SDK/JWT verification mechanism compatible with the runtime. Validate signature, issuer, expiry, authorized party/origin and required subject. Never decode a JWT and treat decoding alone as verification.

Map the immutable provider subject to an internal customer ID. Verified email is not a secure ownership key. Enforce ownership in every customer API route. Customer role metadata from the browser is untrusted. Clerk identity never grants admin permissions.

## 4. Local setup sequence
1. Confirm the exact Development instance and allowed local origin.
2. Verify ignore rules and git status.
3. Set publishable key locally and secret key in local runtime secrets.
4. Start the app and test sign-up, email verification, Google OAuth if enabled, sign-in, callback, sign-out and session refresh.
5. Test server-side token validation, expired/invalid token, wrong issuer/authorized party and cross-customer data access.
6. Test guest brief preservation and optional onboarding.
7. Confirm no secret appears in browser bundles, network responses, logs, Git diff or committed files.
8. Record only non-sensitive metadata (instance type, allowed origin, verification timestamp) in operational docs.

## 5. Production is a separate cutover
Development keys must never be copied to production Pages/Worker secrets or production builds. Production launch requires:
- Owner-approved Clerk Production instance and credentials.
- Production publishable key and server secret stored in correct Cloudflare environments.
- Exact custom domains, callback/redirect URLs and allowed origins.
- Production webhook/signature/JWKS validation strategy.
- Customer data/privacy/retention review.
- Full auth and ownership regression suite.
- Rollback plan and explicit owner approval.

No production Clerk integration is implied by successful local development sign-in.

## 6. Acceptance
Development sign-up/sign-in works on the intended local origin; API rejects invalid/expired tokens; customer A cannot access customer B records; onboarding can be skipped; guest brief is preserved; legacy project links remain valid; secrets are absent from Git and frontend bundles; production keys are not configured from development credentials.
