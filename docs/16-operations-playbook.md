# 16 — Production Operations Playbook

## Daily project operations
1. Review new inquiries.
2. Qualify brief completeness, feasibility, rights and deadline.
3. Record quote, deliverables, revision allowance and terms.
4. Confirm payment or approved exception before production.
5. Assign producer and record production start.
6. Complete internal QA before customer preview.
7. Collect consolidated feedback and track revision count.
8. Record customer approval and deliver final files.
9. Close project and record actual time/tool cost.

## Incident handling
### Provider/tool outage
- Pause affected generation step.
- Inform the customer if delivery timing is impacted.
- Use a verified alternative or manual workflow only if rights and quality permit.
- Record extra cost/time; do not silently substitute materially different output.

### Asset upload or download failure
- Keep project status unchanged until storage is verified.
- Retry safely with idempotency where supported.
- Verify object key, checksum and project ownership.
- Do not send public bucket URLs as a workaround.

### Suspected data exposure
- Disable affected access links and credentials.
- Preserve relevant logs.
- Identify affected projects and data categories.
- Rotate credentials and fix the authorization gap.
- Notify impacted parties as required by applicable law.
- Record incident timeline and remediation.

### Missed deadline
- Notify the customer promptly with a realistic revised estimate.
- Offer agreed remedies according to published terms.
- Do not mark delivered until final assets are available and delivery is verified.

## Customer communication standards
- Acknowledge inquiries without promising acceptance.
- Confirm scope in writing before production.
- Explain what is included and excluded.
- Keep revision feedback consolidated.
- Be transparent about AI-assisted production and material limitations.
- Never guarantee sales, virality or advertising performance.

## Operational records
For each project, retain:
- approved brief and scope
- quote and payment confirmation
- status/event history
- source and final asset metadata
- feedback and approval
- actual production time and direct tool costs
- rights/consent evidence where applicable

Retention periods and deletion procedures must be documented and aligned with applicable privacy requirements.
