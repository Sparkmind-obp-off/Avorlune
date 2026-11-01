# AVORLUNE — Private Admin Authentication & Security Specification

**Status:** Approved design; implementation and security verification pending  
**Authentication provider:** First-party AVORLUNE admin auth (not Clerk)

## 1. Product rule

The admin dashboard is a private operational application. It is not a public customer feature.

- No admin link, login menu, sign-up, invite form, or admin role selector on the customer website.
- Admin deployment is separate from the customer deployment.
- Admin login URL is shared privately with the owner.
- Unknown users receive no account creation path.
- Admin account provisioning and credential rotation are owner-controlled.

A separate hostname is not a security boundary by itself. All admin APIs must independently verify an admin session.

## 2. Initial single-owner model

Start with one owner/admin account. Do not build multi-staff account management yet.

Required deployment secrets:
- `ADMIN_EMAIL`: owner login identifier.
- `ADMIN_PASSWORD_HASH`: password hash generated offline using the repository's approved password-hashing script.
- `ADMIN_SESSION_SECRET`: high-entropy random secret used for session signing or keyed hashing, if required by the implementation.
- `ADMIN_SESSION_TTL_SECONDS`: bounded session lifetime configuration, with a conservative default.
- Optional `ADMIN_TOTP_SECRET`: only if a tested TOTP implementation is introduced.

Never store plaintext passwords, session tokens, recovery codes, or signing secrets in D1, source control, build-time frontend variables, logs, or chat.

## 3. Password handling

- Preserve the existing PBKDF2-based implementation as the baseline if code audit confirms correct parameters and constant-time verification.
- Use a unique random salt per password hash.
- Use a strong work factor appropriate for the runtime and periodically review it.
- Compare derived hashes in constant time.
- Reject weak passwords and enforce a minimum length of at least 12 characters.
- Never reveal whether the email or password was the incorrect field.
- Password reset/rotation is performed through an owner-controlled secret update, not public email reset.

If the existing implementation is not adequate, prefer a maintained password-hashing library or Web Crypto PBKDF2 with documented parameters. Do not invent a custom cryptographic algorithm.

## 4. Session requirements

- Generate cryptographically random opaque session identifiers.
- Store only a keyed hash/hash of the session token server-side.
- Cookie attributes: `HttpOnly; Secure; SameSite=Strict; Path=/`; omit Domain so it is host-only.
- Cookie name must be admin-specific, e.g. `__Host-avorlune_admin`.
- Use a short idle timeout and a bounded absolute lifetime.
- Rotate session after successful login and privilege-sensitive actions.
- Logout revokes current session.
- Logout-all revokes all sessions.
- Credential rotation invalidates every existing admin session.
- Session validation must check revocation and expiry on every protected request.
- Never expose session tokens to JavaScript or localStorage.

## 5. Request protections

- CSRF token required for all state-changing admin requests.
- Validate Origin against the exact admin origin.
- Validate Fetch Metadata headers where available.
- Restrict CORS to exact allowed origins; do not use wildcard origins with credentials.
- Apply layered rate limits by IP and account, with global protection.
- Add progressive delay/temporary lockout without enabling trivial denial-of-service against the only admin.
- Require re-authentication for sensitive operations such as credential changes, export, access-link revocation, and payment reconciliation.
- Use request IDs and security audit events.
- Do not log passwords, cookies, authorization headers, project tokens, or secret values.

## 6. Optional second factor

TOTP or hardware-key MFA may be added after the basic flow is stable. Do not claim MFA is enabled until enrollment, recovery, replay prevention, and tests are implemented. Cloudflare Access can be considered as an additional perimeter layer, but it does not replace application-level admin authentication.

## 7. Admin API authorization

All admin routes must use a dedicated admin-auth middleware. Do not share the Clerk customer middleware or customer project-token middleware.

Protect every route, including:
- project list and details
- quote creation and updates
- manual payment records and reconciliation
- asset upload, download, and revocation
- project status transitions
- internal notes and events
- cost ledger and exports
- provider status and operational settings

Public health checks and explicitly public catalog endpoints must not return admin data.

## 8. Audit events

Record at minimum:
- successful and failed login (without password or raw identifier exposure)
- logout and logout-all
- session revocation
- credential rotation
- project status change
- quote changes
- payment confirmation/reconciliation
- asset upload/download/revoke
- customer access-link creation/revocation
- data export
- security configuration changes

Audit records should include event type, timestamp, actor ID, target reference, request ID, and safe metadata. Avoid storing personal data or secrets unnecessarily.

## 9. Initial provisioning and recovery

- Provision the first admin through secure deployment secrets.
- Verify access in a private browser session after deployment.
- Maintain an owner-controlled recovery procedure outside the application.
- Do not add a public “forgot password” endpoint.
- If credentials are lost, rotate the secret through the trusted Cloudflare account and invalidate sessions.
- Never ask the owner to paste credentials into a chat message.

## 10. Security acceptance tests

- No admin link or login route in customer frontend build/navigation.
- No public admin registration endpoint.
- Missing/invalid/expired/revoked session returns 401.
- Customer Clerk token returns 401/403 on every admin route.
- Customer project token returns 401/403 on every admin route.
- Admin session cannot access another user's private customer data through customer endpoints.
- CSRF failure and invalid Origin reject state-changing requests.
- Login throttling is effective and does not leak account existence.
- Logout and logout-all revoke sessions.
- Password/secret rotation invalidates sessions.
- Cookies have required security attributes.
- Logs and exports contain no secrets or raw tokens.
