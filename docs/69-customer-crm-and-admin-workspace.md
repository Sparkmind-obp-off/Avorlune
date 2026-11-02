# 69 — Customer CRM & Admin Workspace

**Status:** Target specification.

## Customer 360
Internal customer ID, provider subject, verified email, optional profile, consent/preferences, inquiries/brief versions, projects, quote versions, payment ledger references, production events, assets/provenance, support tickets, tags and last activity.

Keep historical project contact snapshots immutable. Internal notes and customer-visible messages use separate fields and API serializers. No customer list or CRM search in public endpoints.

## Queues
New inquiries; clarification; ready to quote; quote awaiting response; deposit pending; production queue; in production; QA; preview/revisions; balance due; final release; support; cancellation/refund review.

## Search
Exact customer ID, verified email, project reference; normalized name search; filters for status, service, dates, payment state, tag and activity. Pagination and bounded result size required. Exports limited, purpose-bound and audited.

## Customer detail
Overview, Projects, Quotes, Payments, Activity, Assets, Support and Consent. Clearly distinguish customer-safe status from internal production notes.

## Actions
Clarify brief, qualify/decline, create immutable quote version, send quote, record decision, reconcile payment, create production task, update status, upload preview/final, record QA/provenance, respond to support and process deletion request. Validate and audit every action.

## Access
Initial owner-only operations; no staff/RBAC expansion unless requested. Admin may have no in-app login form, but real CRM data and mutations must be protected by a verified private perimeter. Never expose CRM APIs publicly.

## Acceptance
Customer lookup returns complete linked history; cross-customer data stays isolated; internal notes never leak; every sensitive action is audited.