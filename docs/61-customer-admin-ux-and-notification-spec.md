# 61 — Customer and Admin UX and Notification Specification

**Status:** UX/operations target.

## Customer navigation

Services, How it works, Work/Examples, About, Start a project, Sign in/My projects. Do not show admin login in customer navigation.

## Customer workspace

Provide active projects, draft briefs, quotations requiring action, payment schedule/receipts, production timeline, clarifications, revisions, previews/final files, support tickets, and account/privacy controls.

Project detail sections: Overview, Brief and accepted scope, Timeline, Quotation, Payments, Preview and files, Feedback/revisions, Support.

## Admin workspace

Prioritize queues:
- New briefs and clarification.
- Quotes to prepare / awaiting acceptance.
- Deposits awaiting verification.
- Paid projects awaiting production.
- Production and QA.
- Preview awaiting customer.
- Balances due.
- Final delivery ready.
- Refund/support cases.
- Provider/license warnings.

Project detail should show canonical timeline, accepted scope, payment schedule, asset provenance, internal costs, customer communication, and audit trail.

## Notifications

Use existing notification outbox. Sending may remain manual until transactional email is approved/configured.

Events: brief received, clarification requested, quotation ready/expiring, quotation accepted, deposit due/confirmed/failed, production started, preview ready, revision update, balance due/confirmed, final delivery ready, project completed, refund update, support reply.

Promotional marketing requires separate consent and unsubscribe handling.

## Content security

Include project reference, event/status, next action, amount due only from authoritative schedule, and authenticated portal link. Never include API keys, signatures, raw project tokens, private object keys, or unrestricted download links.

## Accessibility and localization

Indonesian first, plain language, mobile-first, keyboard accessible, clear errors, visible payment status/next step, reduced-motion support, and status labels that do not rely on color alone.

## Acceptance

Customer always understands next action; deposit and balance are distinct; admin queues reflect operational state; notifications are idempotent/auditable; manual send is not labelled delivered; internal notes and credentials never appear to customers.
