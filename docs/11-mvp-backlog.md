# 11 — MVP Backlog & Acceptance Criteria

Priorities: P0 required for usable MVP; P1 valuable next; P2 deferred.

## P0 — Public experience
- [ ] Responsive home page with clear value proposition and CTA.
- [ ] AI Image and AI Video service pages.
- [ ] Portfolio with explicit sample rights/permissions.
- [ ] Process, FAQ, contact, privacy and terms pages.
- [ ] Accessible navigation and form controls.

**Acceptance:** visitor can understand the offer, inspect work and submit a project inquiry on mobile and desktop.

## P0 — Inquiry
- [ ] Required-field validation on client and server.
- [ ] Service type, objective, intended use, format and deadline fields.
- [ ] Optional reference links and secure file upload.
- [ ] Consent checkbox and privacy notice.
- [ ] Rate limiting, spam prevention and duplicate submission handling.
- [ ] Confirmation with non-sequential project reference.

**Acceptance:** valid request is persisted once; invalid or abusive submissions are rejected safely; customer receives a truthful confirmation.

## P0 — Admin operations
- [ ] Protected admin login.
- [ ] Project inbox with filters and pagination.
- [ ] Project detail and brief view.
- [ ] Quote/scope recording.
- [ ] Controlled status transitions.
- [ ] Audit event history.

**Acceptance:** unauthorized users cannot read or mutate project records; every important transition is attributable.

## P0 — Delivery
- [ ] Private R2 bucket.
- [ ] Upload intent and server-side verification.
- [ ] Preview/final asset distinction.
- [ ] Temporary authorized download.
- [ ] Feedback and approval record.

**Acceptance:** one customer cannot access another customer's assets; expired links stop working; approval is auditable.

## P1 — Customer experience
- [ ] Verified customer access link or account.
- [ ] Project timeline and status notifications.
- [ ] Consolidated revision feedback.
- [ ] Customer download history.

## P1 — Commercial operations
- [ ] Quote acceptance.
- [ ] Manual payment confirmation with actor and timestamp.
- [ ] Basic project economics and production-time reporting.

## P2 — Integrations
- [ ] One verified AI provider adapter.
- [ ] Email provider integration.
- [ ] Payment gateway after account credentials and webhook tests.
- [ ] Queue-based async processing if required.

## Definition of done
- TypeScript checks pass.
- Unit and integration tests cover critical paths.
- Authorization and asset isolation tests pass.
- No secrets or customer data in repository.
- Deployment environment variables and bindings documented.
- README reflects actual implementation status.
