# 67 — Customer Authentication & Onboarding

**Status:** Target specification; integration pending.

## Decision
Use Clerk for customer identity, consistent with the existing target architecture. Clerk is customer-only. Public pages and service discovery remain accessible without sign-in. A verified customer session is required to submit briefs, save account drafts, view projects, quotes, payments and private deliverables.

## Sign-in
Start with email verification and Google sign-in if production configuration is available. Do not store customer passwords in AVORLUNE when Clerk handles credentials. Do not enable SMS/phone until costs and abuse controls are approved.

## Identity mapping
Map Clerk provider subject to an immutable internal customer ID. Verified email is an attribute, not a primary ownership key. Backend validates signature, issuer, audience/authorized party, expiry and claims with a maintained library. Never trust browser-supplied IDs or role metadata. Enforce ownership on every object request.

## Onboarding
Optional and skippable. Ask only for display name, individual/business context, optional organization, intended content type and communication preference. Save onboarding version and completion timestamp. Do not block service discovery or project creation on nonessential fields.

## Guest transition
Allow browsing and an in-progress brief before sign-in. Preserve the draft through the auth redirect, then bind it to the verified customer account server-side. Existing signed project links remain supported until a tested ownership-claim migration. Never attach a legacy project solely by matching unverified email.

## Lifecycle
Active, restricted, deletion_requested, deleted/anonymized. Support sign-out, session revocation, verified contact changes, export/deletion requests and retention-aware deletion. Financial/audit records may require retention and pseudonymization rather than erasure; obtain Indonesian legal/privacy review.

## Acceptance
Invalid JWT rejected; cross-customer access denied; onboarding can be skipped; draft survives sign-in; sign-out ends access; legacy signed links continue working; account deletion respects retention.