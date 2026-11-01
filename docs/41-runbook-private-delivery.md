# 41 — Runbook: Private File Delivery & Final Approval (A2/A3)

**Status:** Code implemented and tested (commit `d37b09b`). **Delivery is DISABLED in production** because no R2 bucket is bound (owner approval pending, ADR-008). Customer and staff final approval are therefore disabled too (fail closed).

## Final-approval invariant (A2), enforced server-side
Approval (customer `POST /projects/:ref/approval`, or staff `PATCH …/status → approved`) succeeds only if **all** hold:
1. A private store binding `DELIVERY_BUCKET` is present and R2-compatible (put/get/head/delete). A non-R2 binding is ignored.
2. The request names a specific `assetId`.
3. That asset belongs to **this** project, `asset_kind='final'`, `status='active'`.
4. The object exists in private storage (`head` succeeds).
5. Customer: valid, unexpired, unrevoked project token; project in `customer_review`.
6. Staff: additionally a written reason.

The approved asset is stored in `projects.approved_asset_id` and in the audit event (assetId, version, checksum). `delivered` re-checks that the approved asset is still active and present. A repeat approval returns 409.

## Delivery mechanics (A3) once enabled
- **Upload:** `POST /api/v1/admin/projects/:id/assets?kind=preview|final&filename=…` (raw body, admin session + CSRF). Only in producing / internal_review / customer_review / revision.
- **Validation:** magic-byte allowlist (PNG, JPEG, WebP, MP4, MOV, WebM, PDF); max 25 MB; random object key `projects/<projectId>/<uuid>`; SHA-256 checksum; sanitised filename. No API ever returns the storage key.
- **Customer download:** `GET /api/v1/projects/:ref/assets/:assetId/download` with an `x-project-token` header (never in the URL). Only in customer_review / revision / approved / delivered. Responses carry `Cache-Control: private, no-store`, `Content-Disposition: attachment` and a sandbox CSP. Every download is audited.
- **Revoke:** `POST …/assets/:assetId/revoke` with a reason. The file becomes undownloadable and cannot satisfy approval.
- The bucket is never public: no r2.dev URL, no presigned URLs, no R2 credentials in the app.

## Activation steps (require explicit owner approval)
R2 must be enabled on the Cloudflare account (payment method on file). Check current R2 pricing and free-tier limits on cloudflare.com before enabling; this document makes no cost claim.
1. Owner enables R2 and approves a spend cap.
2. `npx wrangler r2 bucket create avorlune-assets` (keep public access off).
3. Uncomment the `r2_buckets` line under `env.production` in `wrangler.jsonc` (binding `DELIVERY_BUCKET`). Never add it to `env.preview`.
4. Deploy. On a synthetic test project: upload, download via a customer link, revoke, confirm 404. Then remove the test data per policy.
5. Update docs/37, docs/39 and the README.

## Interim manual secure-delivery procedure (while disabled)
Portal approval stays disabled. For a supervised pilot:
1. Deliver through a private, access-restricted share the owner controls (restricted to the client's email, with an expiry). Never a public "anyone with the link" permanent URL.
2. Add an internal note on the project: channel, filenames, version, SHA-256 checksum, date, expiry. Notes are staff-only and audited.
3. Get the client's written approval (email or WhatsApp) that references the filenames or checksums, and record it as an internal note with the date. **Do not** set the project to `approved`; the server refuses this without a portal final asset, by design.
4. Log the delivery time in the cost ledger, and close the share after the agreed period.

**Release consequence:** Gate 1 (limited production) stays blocked until delivery is enabled and verified live.
