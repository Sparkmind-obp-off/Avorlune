# AVORLUNE Repository Audit & Gap Register

**Audit date:** 2026-11-01  
**Scope:** Static repository review of the current `main` branch: README, product/technical/security/launch documents, schema migration, Hono routes, auth middleware, environment bindings, tests, and research specifications.  
**Audit type:** Documentation and source inspection. This is not a live penetration test, production smoke test, legal opinion, or independent Cloudflare account audit.

## 1. Executive assessment

AVORLUNE has a coherent service-led product definition and a substantial foundation: public inquiry intake, admin project management, quote records, manual payment confirmation, signed customer project links, feedback, approval, audit events, and test coverage are represented in the repository.

However, the repository itself documents important deferred features. The current application should be treated as an **operational MVP / controlled pilot**, not a fully production-ready client delivery platform.

The most material gap is the mismatch between the intended end-to-end workflow and actual asset delivery: the database has an `assets` table, but the README says R2 upload/private delivery is not implemented. The customer portal can collect feedback and approval, but the current customer API does not expose asset upload/download routes. The customer approval endpoint transitions a project to `approved` based on review state; it does not verify that a final asset exists and is available for download. This must be resolved before representing the portal as an end-to-end delivery system.

## 2. What is present in the repository

Based on source inspection:
- React + Vite + TypeScript frontend and Hono API hosted through Cloudflare Pages Functions.
- D1 schema and migration for users, projects, quotes, payments, assets metadata, feedback, events, sessions, rate limits, and idempotency keys.
- Public service/portfolio endpoints and validated inquiry intake.
- Admin login, session cookie, CSRF checks, project inbox/detail, quote, manual payment, status and audit operations.
- HMAC-signed, expiring and revocable customer project links.
- Customer quote decision, feedback, and approval endpoints.
- Unit and API integration test files, plus documented test results in README.
- 36 numbered planning/operational documents and a master system prompt.

The README reports 42 tests and previous implementation/deployment checks. This audit did not execute the test suite or independently re-run live deployment checks; treat those as repository-reported results until re-run.

## 3. Critical and high-priority gaps

### G0 — Private asset delivery is not implemented
**Evidence:** README explicitly defers R2; `assets` exists only as schema metadata; the listed customer API has no asset listing/download endpoint; no R2 binding appears in `wrangler.jsonc`.

**Risk:** The service cannot provide a complete private, auditable in-portal handoff. External manual transfer creates operational friction and a separate security boundary.

**Required work:**
- Decide and approve storage provider/billing setup; do not enable paid infrastructure without owner approval.
- Add private bucket binding, upload-intent and completion verification, MIME/size/signature checks, checksum, object ownership checks, and private download authorization.
- Add preview/final distinction, versioning, expiry/revocation, and customer asset listing/download history.
- Add tests for cross-project isolation, expired links, tampered IDs, oversized files, disallowed types, and missing objects.
- Do not claim secure portal delivery until tested end to end.

### G0 — Approval is not coupled to final asset availability
**Evidence:** `POST /projects/:reference/approval` checks that the project is in `customer_review` and transitions it to `approved`; it does not check for a final asset record or verified downloadable object.

**Risk:** A customer could approve a project before a final file is actually stored or accessible.

**Required work:** Define a release invariant: approval can occur only against a specific final asset/version (or explicitly document an alternative approval model). Ensure the final asset is present, private, readable by the intended customer, and linked to the approval event. Add tests for approval with no final asset and approval against the wrong project/version.

### G0 — Preview deployment shares production D1
**Evidence:** README and ADR-006 explicitly warn that preview deployments share production D1 until separate preview resources are configured.

**Risk:** Test submissions, migrations, or preview defects could affect real customer records.

**Required work:** Configure a separate preview D1 database and separate secrets/bindings. Add an environment guard that refuses production data access from preview deployments. Test preview isolation before using preview URLs.

### G1 — Privacy and legal documents are drafts
**Evidence:** README calls Privacy and Terms drafts; launch checklist requires final privacy notice, terms, and retention/deletion procedure. Retention document is explicitly proposed and not legally validated.

**Risk:** Real customer data may be collected before purposes, legal basis, controller/contact details, retention, processor disclosures, rights requests, complaint process, and contract terms are finalized.

**Required work:** Prepare a publication-ready privacy notice, service terms, client production agreement, cancellation/refund rules, data-processing/vendor disclosure, retention schedule, and deletion-request SOP. Have Indonesian legal/privacy/tax requirements reviewed by a qualified professional. Do not publish draft text as final legal advice.

### G1 — No notification channel
**Evidence:** README says email/WhatsApp notifications are not implemented and no provider is selected.

**Risk:** Customer confirmation and project updates depend on manual follow-up; delays and missed messages are likely.

**Required work:** Define the manual fallback first (owner, response window, message templates, communication log). Later select one provider only after pricing, consent, deliverability, and data handling are checked. Test failure/retry and duplicate notification handling.

### G1 — Payment is manual only
**Evidence:** README and admin route expose manual payment confirmation; no gateway/webhook integration is present in the documented API.

**Risk:** Payment reconciliation and evidence are operationally dependent on the admin; a manual status may be mistaken for a provider-confirmed transaction.

**Required work:** Keep the label explicitly “manual confirmation”; record evidence reference and actor; reconcile refunds/partial payments/overpayments. Add a gateway only after merchant account, credentials, webhook signature verification, idempotency, refund and settlement behavior are tested. Never trust browser-supplied payment status.

### G1 — One configured admin; no operational staff roles
**Evidence:** README says one admin from secrets; producer role exists in schema only. Auth middleware accepts admin/producer sessions, but no multi-staff provisioning workflow is documented.

**Risk:** No safe delegation, staff offboarding, or least-privilege producer workflow.

**Required work:** Decide whether single-operator mode is sufficient for the pilot. Before adding staff, implement invitation/provisioning, role matrix, permission tests, account disable/revoke, audit attribution, and session revocation.

### G1 — Retention, backups, and recovery are not operationalized
**Evidence:** README lists retention/deletion automation and backups runbook as unfinished; launch checklist requires backups and recovery steps.

**Risk:** Data loss, excessive retention, or inability to respond to deletion/security incidents.

**Required work:** Document D1 backup/export cadence, restore test, RPO/RTO targets, retention owner, deletion workflow including backups/legal holds, and incident evidence handling. Do not claim backups are working until a restore has been tested.

## 4. Medium-priority gaps

### G2 — No validated customer segment, offer, or price
**Evidence:** ADR open assumptions; docs/31 and docs/32 are validation plans/hypotheses, not evidence of completed interviews or accepted paid pilots.

**Required work:** Run a bounded, Rp0-first validation cycle. Store evidence and negative results. Do not publish package prices or claim market validation before real buyer evidence exists.

### G2 — No AI production provider integration
**Evidence:** README and docs/28 state no AI provider adapter or Apify integration is configured. Provider UI access is not proof of API availability or commercial rights.

**Required work:** Evaluate one workflow/provider at a time: official API access, account entitlement, price, output rights, customer-data handling, safety controls, fallback, and unit economics. Keep production human-reviewed. Apify execution remains approval-gated.

### G2 — Research console/database is only a proposal
**Evidence:** docs/24 and docs/28 explicitly say proposed; no research migration or research API/UI is in the current tree.

**Required work:** Do not imply the research intelligence module exists. First validate manually, then implement an additive migration and protected admin workflow only when useful and approved.

### G2 — No rights-cleared portfolio
**Evidence:** README reports empty portfolio until rights-cleared samples exist.

**Required work:** Produce original samples with documented human contribution, tool/model/version, source assets, terms, and commercial-use review. Get explicit client permission before publishing client work. Avoid invented testimonials/case studies.

### G2 — No domain, brand, and trademark clearance
**Evidence:** README and legal docs say working name and clearance pending.

**Required work:** Check exact and similar/phonetic marks in PDKI/WIPO, domain registrar availability and social handles directly. Record date, query, classes, results, and reviewer. Obtain professional review before filing or making a clearance claim.

### G2 — Operational economics not captured as structured project data
**Evidence:** docs/36 defines KPIs, but current project schema does not show structured time logs or per-project cost ledger.

**Required work:** Add lightweight project time/cost capture (labor, generation credits, stock/music, revisions, refunds) before scaling. Keep actuals separate from estimates.

### G2 — Customer link and lifecycle edge cases need further verification
**Evidence:** Signed customer links are implemented; README describes 30-day expiry and revocation. Current audit did not perform live adversarial testing.

**Required work:** Re-test link issuance, token handling, revocation, browser history/referrer behavior, customer approval, quote rejection, repeated feedback, expired links, and rate-limit behavior against deployed production and preview environments. Confirm links are never logged or exposed to analytics.

## 5. Security review notes

Positive controls visible in source:
- Password hash verification and constant-time comparison helper.
- Session token hash stored in D1; HttpOnly/Secure/SameSite=Strict cookie.
- CSRF token and same-origin check for state-changing staff requests.
- HMAC-signed, expiring, revocable customer project token.
- Hashed IP identifiers in rate-limit table.
- Server-side Zod validation and bounded JSON payload.
- Project status transitions use guarded database batches and audit events.
- API responses are documented as no-store and security headers are configured.

Items requiring verification/hardening:
1. Rate limits currently depend on the platform-provided client IP header. Verify Cloudflare deployment behavior and ensure untrusted forwarded headers cannot be used to evade limits in any alternate hosting path.
2. Login throttling is per IP; review account-level and distributed-abuse defenses, alerting, and recovery procedure.
3. Session records contain a CSRF token; confirm database access controls and retention/cleanup are sufficient. Consider rotating/revoking sessions on credential changes.
4. Ensure sensitive fields in admin exports, errors, analytics, and logs are deliberately scoped and redacted.
5. Add dependency vulnerability review and a repeatable security update process.
6. Run a live security review of CSP, cookie scope, referrer policy, CORS/origin behavior, and customer-link fragment/sessionStorage handling.
7. Validate D1 backup and restore, Cloudflare secret rotation, and incident response in practice.

No critical exploit was confirmed by this static review. Absence of a confirmed exploit is not proof of security.

## 6. Documentation consistency issues

- docs/11 marks R2 private delivery as P0, while the implemented app defers it. README correctly identifies the deferral; keep backlog status explicit and synchronized.
- docs/13 is a pre-implementation handoff document and says the repository is a target architecture. It should be labeled historical/planning reference or updated with a link to the actual implementation handoff.
- docs/14 launch checklist remains a NO-GO until critical delivery, legal, preview isolation, backup, and operational gates are evidenced.
- docs/24/28 are proposals, not deployed research functionality.
- docs/31/32 are plans/hypotheses, not validation results or approved price lists.
- docs/35 retention periods are proposed, not approved legal policy.
- README says tests were run previously; future status reports should include commit SHA, command, date, and observed result.

## 7. Recommended execution order

### Phase A — Safe pilot readiness
1. Separate preview and production D1/secrets.
2. Decide the approved private delivery approach; if R2 spend is not approved, explicitly constrain pilot delivery to a documented manual secure process.
3. Couple customer approval to an identified final asset or document the approved alternative.
4. Finalize privacy, terms, client agreement, rights and refund wording with appropriate review.
5. Test the full inquiry → quote → payment → production → review → final delivery → approval flow using synthetic data.
6. Define manual support/notification ownership and response process.

### Phase B — Commercial proof
7. Select one initial segment.
8. Conduct documented buyer discovery.
9. Offer a bounded paid pilot and measure actual labor, tool cost, revisions, and contribution margin.
10. Create rights-cleared portfolio samples only after the process is documented.

### Phase C — Controlled automation
11. Add structured cost/time records.
12. Add one notification provider if justified.
13. Evaluate one AI provider API with commercial and privacy checks.
14. Implement research tables/Apify adapter only after budget and approval controls are accepted.
15. Add staff roles only when workload requires them.

## 8. Release decision

**Current recommendation: NO-GO for unrestricted production launch. Conditional GO for a small, manually supervised pilot only if the owner accepts the current delivery limitations, uses synthetic data for testing, has final customer-facing terms reviewed, and handles file transfer through a documented private method.**

A full GO requires evidence for all G0 and G1 items, successful end-to-end and isolation tests, verified backups/restore, and an approved legal/operational policy set.

## 9. Audit limitations
This review inspected the repository's current source and documents through GitHub. It did not:
- execute `npm run check` or run local builds;
- inspect Cloudflare dashboard settings, secrets, bindings, D1 production rows, or account billing;
- run live endpoint, browser, penetration, or load tests;
- verify current provider terms, trademark availability, or legal compliance;
- verify that the deployed Pages version exactly matches the current repository commit.

All such checks must be separately performed before the repository can be certified as production-ready.
