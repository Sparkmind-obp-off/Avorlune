# 15 — Test Strategy

## Testing objective
Prove that a customer can move from inquiry to private approved delivery, and that one customer cannot access another customer's data.

## Test layers
### Unit tests
- Inquiry validation and normalization.
- Public project reference generation.
- Quote calculations using integer minor currency units.
- Project status transition rules.
- Role and permission policy.
- Asset metadata validation.
- Signed-link expiry logic.

### API integration tests
- Create valid inquiry.
- Reject invalid/missing fields.
- Rate-limit abusive requests.
- Admin authentication and authorization.
- Create/update quote.
- Reject invalid project status transition.
- Create upload intent and verify object completion.
- Submit feedback and customer approval.
- Prevent cross-project access.

### UI tests
- Public navigation and CTA.
- Inquiry form validation and submission.
- Loading, empty, error and success states.
- Admin project inbox and detail.
- Status update confirmation.
- Preview, feedback and download flow.
- Responsive behavior and keyboard accessibility.

### Security tests
- Unauthenticated access to admin endpoints is denied.
- Customer A cannot read Customer B's project or asset.
- Expired or tampered asset links are denied.
- Disallowed MIME types and oversized files are rejected.
- Status/payment fields cannot be elevated by customer input.
- Secrets and signed URLs do not appear in logs or client bundles.
- CSRF protections are tested if cookie-based sessions are used.

## Critical end-to-end scenario
1. Visitor submits a valid project inquiry.
2. System returns a unique public reference.
3. Producer signs in and qualifies the inquiry.
4. Producer creates a scoped quote.
5. Payment is recorded through a verified process.
6. Producer moves the project to production.
7. Producer uploads a private preview.
8. Customer reviews and submits feedback.
9. Producer uploads revised/final deliverable.
10. Customer approves and downloads final asset.
11. Project event history shows the full sequence.

## Test data
Use synthetic names, emails, briefs and assets. Never use real customer data in automated tests. Keep test storage and database isolated from production.

## Release gates
- Typecheck passes.
- Lint passes where configured.
- Unit tests pass.
- API integration tests pass.
- Cross-project authorization tests pass.
- Critical end-to-end scenario passes in preview.
- No known critical/high severity security issue remains unresolved.

Do not report a test as passed unless the command ran and its result was observed.
