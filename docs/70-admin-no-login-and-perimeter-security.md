# 70 — Admin No-Login UX & Private Perimeter Security

**Status:** Owner preference recorded; secure implementation boundary required.

## UX decision
Admin workspace should not show an AVORLUNE application username/password login form and must not offer public admin registration. It should open directly for an authorized operator. This supersedes the previous admin login-form UX described in docs 47–50, but does not waive backend authorization.

## Non-negotiable security
A dashboard containing customer PII, payment records, private assets and mutation controls must never be unrestricted public. Before removing the existing application login, configure and verify a private network/perimeter policy protecting both admin frontend and every admin API route.

A perimeter may use a private network/VPN or approved edge access policy. If the selected edge policy asks the operator to identify themselves, that is perimeter-level access, not an AVORLUNE app login. If the owner means no identity check and no network restriction whatsoever, only a public read-only synthetic demo is safe; real CRM and mutations must remain inaccessible.

## API
Verify trusted perimeter assertions server-side. Never trust a client-supplied header or secret embedded in frontend JavaScript. Restrict CORS to exact origins; CORS is not access control. Use CSRF/Origin/Fetch Metadata protections where cookie mutations apply. Rate-limit and audit sensitive reads, exports and mutations. Keep customer tokens separate from admin perimeter assertions.

IP allowlisting is acceptable only with stable controlled egress, tested deny/allow behavior and recovery path. A hidden URL, robots.txt, obscurity or CORS is never sufficient.

## Migration
Keep current admin login until perimeter is deployed and verified. Test public denial for every admin route, allowed operator access, audit trail and recovery. Remove in-app login only after all checks pass. If any check fails, retain existing protection.

## Acceptance
No app login form; no registration; public users cannot read/mutate CRM; backend independently verifies trusted perimeter; actions audited. No production auth removal before approval and tests.