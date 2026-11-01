# AVORLUNE — Cloudflare R2 Production Asset Storage Specification

**Status:** REQUIRED architecture dependency; production bucket NOT YET PROVISIONED  
**Target binding:** `DELIVERY_BUCKET`  
**Target bucket name:** `avorlune-assets`  
**Storage class:** Standard  
**Visibility:** Private only

## 1. Decision

Cloudflare R2 is the required object-storage layer for customer uploads, working assets, private previews, and final deliverables. The feature is not considered production-ready until the production bucket exists, is bound to the production runtime, and the upload/download/approval/delivery path passes end-to-end tests.

R2 is not a frontend and does not need its own customer-facing application. Both Customer and Admin frontends use the same API, and the API accesses R2 through the `DELIVERY_BUCKET` binding.

The codebase already contains private-delivery logic guarded by this binding. Without the binding, private delivery and final approval remain disabled/fail-closed. Do not pretend a bucket exists merely because code and tests use an in-memory R2 stand-in.

## 2. Initial architecture

Start with **one private production bucket**:
- Bucket: `avorlune-assets`
- Worker binding: `DELIVERY_BUCKET`
- Standard storage class
- No public bucket access
- No `r2.dev` public URL
- No public custom domain
- No public listing
- No direct browser credentials

Keep small public marketing/portfolio images in the customer frontend's static assets for the initial release. A separate public bucket is not required now.

## 3. Stored asset categories

- Customer-uploaded source images, videos, and references.
- Creative briefs and approved supporting documents.
- Internal working files and intermediate renders.
- Private review previews.
- Final customer deliverables.
- Any approved evidence needed for a project handover.

Do not store secrets, payment-card data, passwords, or unnecessary identity documents in R2.

## 4. Object key and metadata design

Use opaque, non-guessable object keys, for example:

```text
projects/<internal-project-id>/<random-object-id>
```

Do not include customer names, email addresses, phone numbers, project titles, or public reference codes in object keys.

D1 remains the metadata/system-of-record layer. Store only required metadata such as:
- internal asset ID and project ID
- opaque R2 object key
- asset kind (source, working, preview, final)
- validated MIME type and file size
- checksum/hash where useful
- lifecycle state (active, revoked, superseded)
- created timestamp and actor ID
- approval marker / approved asset ID

Never put binary file contents in D1.

## 5. Access control

All private R2 operations go through the shared backend API:
- Customer upload: authenticated project/customer context and project ownership check.
- Customer download: valid project token or verified customer identity, plus project ownership and active-asset check.
- Admin upload/download/revoke: independent first-party admin session, CSRF/Origin protections for mutations, and audit event.
- Final approval: only an active final asset belonging to the same project can be approved.
- Delivery: only the specifically approved final asset may be marked delivered.

The frontend must never receive R2 access keys or unrestricted bucket credentials.

If presigned URLs are introduced later, use short expirations, narrow object/method scope, and server-side authorization before issuing them. Treat each URL as a bearer credential. Do not add a public bucket to simplify downloads.

## 6. Upload and content safety

Preserve the current implementation limits unless a reviewed change is approved:
- Maximum upload size: 25 MB per object.
- MIME allowlist plus magic-byte/content-signature validation.
- Reject executable or unsupported file formats.
- Generate object keys server-side.
- Set safe content disposition and content type.
- Use private/no-store cache headers for private downloads.
- Prevent path traversal and user-supplied object-key access.
- Enforce per-project and per-request rate limits.
- Audit uploads, downloads, revocations, approval and delivery.
- Avoid logging file content, credentials, or signed access tokens.

Any future larger-video workflow should use a separately designed multipart/resumable upload path with quotas and cost controls.

## 7. Lifecycle, retention and deletion

Define retention by asset type and contractual obligations before enabling automated deletion. Do not create a lifecycle rule that can delete active projects or legally required records.

Required operational actions:
- Revoke database metadata before/with object deletion.
- Make deletion idempotent and auditable.
- Support project closure and customer data deletion requests.
- Retain payment evidence only as long as required by accounting/legal policy; store only minimal references in the asset store.
- Review abandoned uploads and orphan objects periodically.
- No automatic purge until retention policy is approved.

## 8. Activation runbook

Activation is required for live private delivery, but it may require completing Cloudflare R2 subscription/billing setup. This document does **not** authorise paid billing or bucket creation.

When the owner explicitly approves activation:
1. Confirm the exact Cloudflare account and production environment.
2. Review the R2 subscription checkout and current pricing before confirming.
3. Create one Standard private bucket named `avorlune-assets`.
4. Add production-only binding `DELIVERY_BUCKET` in the production Pages/Worker configuration.
5. Do not bind production R2 to preview deployments.
6. Verify preview runtime has no R2 binding and returns the expected fail-closed response.
7. Run tests using synthetic, non-customer files: upload → list → download → revoke → verify denied.
8. Test customer A cannot read customer B's object.
9. Test admin access and audit trail.
10. Test final-asset approval and delivered transition against a real private object.
11. Verify usage/billing dashboard and set alerts or owner review cadence.
12. Record bucket name, binding, environment, test evidence and deployment commit. Never record credentials.

## 9. Pricing and cost controls

Cloudflare's current published R2 Standard allowance includes monthly:
- 10 GB-month storage
- 1 million Class A operations
- 10 million Class B operations
- no R2 egress charge

Published Standard rates beyond included usage: $0.015 per GB-month, $4.50 per million Class A requests, and $0.36 per million Class B requests. Recheck the live pricing page before activation because prices/allowances can change.

Standard is the initial choice because production customer assets and previews can be read frequently and Standard has no retrieval fee or minimum storage duration. Do not choose Infrequent Access for active project assets.

Cost controls:
- Set application-level upload size limits and per-project quotas.
- Avoid repeated polling/listing and duplicate uploads.
- Track bytes stored and operation counts.
- Review usage monthly.
- Do not enable paid add-ons or other storage products without explicit approval.

## 10. Acceptance criteria

R2 production storage is considered ACTIVE only when:
- Production bucket exists and is private.
- `DELIVERY_BUCKET` is bound only to production.
- Worker can write/read/delete using the binding.
- No public access path exists.
- Ownership and admin authorization tests pass.
- Preview has no production R2 binding.
- Upload/download/revoke tests pass.
- Final asset approval and delivery tests pass.
- Audit events are visible and contain no secrets.
- Usage/cost monitoring is documented.

Until then, status remains **BLOCKED / NOT ACTIVE** and manual private delivery remains the operational fallback in docs/41 and docs/44.
