# 14 — Launch Readiness Checklist

A checklist for deciding whether AVORLUNE can safely accept real customer projects through the portal.

## Brand and public claims
- [ ] Name/domain/social screening completed and documented.
- [ ] Trademark screening completed in PDKI and WIPO, including similar/phonetic marks.
- [ ] Qualified IP review obtained where appropriate.
- [ ] Public copy accurately describes AI-assisted production.
- [ ] No fabricated portfolio, testimonials, customer logos or performance claims.
- [ ] Domain ownership, DNS and TLS verified.

## Commercial readiness
- [ ] One target customer segment selected.
- [ ] At least one offer has been tested with real prospective buyers.
- [ ] Scope, deliverables, formats and exclusions are clear.
- [ ] Pricing covers labor, tools, revisions, licensing and margin.
- [ ] Revision allowance and out-of-scope change policy are published.
- [ ] Turnaround estimates are operationally achievable.
- [ ] Refund, cancellation and dispute policy is documented.
- [ ] Payment status is verified; no false payment confirmation.

## Production and rights
- [ ] Each production tool's commercial terms have been checked.
- [ ] Uploaded references, logos, music, footage and likeness permissions are covered.
- [ ] Human QA checklist is used.
- [ ] Customer approval is recorded before final closeout.
- [ ] Usage/license terms accompany delivery.
- [ ] Portfolio reuse requires separate explicit permission.

## Application and security
- [ ] Admin authentication and role authorization tested.
- [ ] Customer/project data isolation tested.
- [ ] R2 bucket is private.
- [ ] Signed links expire and are scoped.
- [ ] File type, size and signature validation are active.
- [ ] Public inquiry endpoints are rate-limited and spam-protected.
- [ ] Secrets are not present in Git or frontend bundles.
- [ ] Logs redact sensitive content.
- [ ] Backups and recovery steps are documented.
- [ ] Privacy notice, terms and retention/deletion procedure are published.

## Operational readiness
- [ ] Support contact and response expectations are published.
- [ ] Producer/admin can process a project end-to-end.
- [ ] Customer notification flow has been tested.
- [ ] Failed upload, failed notification and provider outage have a manual fallback.
- [ ] Project reference and audit history are exportable.
- [ ] A test project has completed the full workflow.

## Release decision
Record:
- Release candidate:
- Reviewer:
- Date:
- Open blockers:
- Decision: GO / NO-GO

A GO decision requires all critical security, rights, payment and delivery blockers to be resolved. A checked box must reflect a test or evidence, not an assumption.
