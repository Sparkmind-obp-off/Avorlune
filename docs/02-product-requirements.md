# 02 — Product Requirements Document (PRD)

**Product:** AVORLUNE client-facing creative production portal  
**Version:** 0.1 planning baseline

## Problem
Customers often struggle to translate a marketing need into a usable creative brief, understand production scope, track revisions, and receive final assets in an organized way.

## Product outcome
A simple portal that converts an inquiry into a structured production request and gives the customer visibility from brief to approved delivery.

## Primary users
- Customer: submits a brief, provides references/assets, reviews previews, requests included revisions, downloads approved deliverables.
- Producer/admin: qualifies requests, scopes and quotes work, manages production stages, uploads previews/finals, records feedback and closes orders.

## MVP user stories
### Customer
- As a visitor, I can understand the services and see sample work.
- As a customer, I can submit a project brief with service type, objective, audience, style, format, deadline preference and references.
- As a customer, I can receive an acknowledgement and a project reference.
- As a customer, I can view status and review preview files through a private link or authenticated account.
- As a customer, I can submit consolidated feedback and download approved files.

### Producer/admin
- As an admin, I can view and qualify incoming requests.
- I can set scope, quote, deliverables, revision allowance and estimated timeline.
- I can move a project through defined stages.
- I can upload preview and final assets privately.
- I can record customer approval and close a project.

## MVP scope
- Responsive public landing page and service pages.
- Portfolio/sample gallery with rights-cleared assets only.
- Structured project inquiry form.
- Request confirmation and project reference.
- Basic admin access and project management.
- Status timeline.
- Private preview/final asset storage and expiring/signed download links.
- Feedback and approval capture.
- Basic event/audit log.

## Explicitly out of scope for MVP
- Fully autonomous generation from customer prompt.
- Public self-serve AI generation credits.
- Native mobile applications.
- Complex subscriptions, wallet, marketplace, creator network or affiliate features.
- Automatic social posting.
- Multiple provider integrations before a real production need.
- Guaranteed instant turnaround.

## Functional requirements
1. Validate required fields and accepted file types/size.
2. Store customer brief and uploaded references securely.
3. Generate a non-sensitive human-readable project reference.
4. Enforce role-based access to admin and project assets.
5. Record every status change with actor and timestamp.
6. Separate preview assets from approved final assets.
7. Capture revision feedback as structured text.
8. Notify the customer only through configured channels; no fake delivery status.
9. Provide admin ability to mark a quote as accepted/rejected and project as paid/unpaid/manual-confirmed.
10. Retain an exportable project record.

## Non-functional requirements
- Mobile-first responsive UX.
- Accessible forms and keyboard navigation.
- Server-side validation and authorization.
- No secrets in client bundles or repository.
- Private-by-default asset storage.
- Observable errors without logging sensitive brief contents or credentials.
- Graceful degradation if an AI provider is unavailable.

## Success criteria for MVP
A real user can submit a brief, receive a human-reviewed quote, approve scope, follow production status, provide feedback and download final assets without staff needing to manage the process through scattered chat messages.

## Assumptions to validate
- Which first customer segment has the strongest paid need.
- Which deliverables customers buy repeatedly.
- Preferred contact and notification channel.
- Acceptable turnaround and revision policy.
- Actual tool/API rights, costs and commercial usage terms.
