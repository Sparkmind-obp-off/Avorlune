# 71 — Demo & Staging Isolation

**Status:** Target specification.

## Modes
1. Public interactive demo: synthetic customer, fictional brief, illustrative quote, simulated timeline and licensed/sample preview assets.
2. Internal staging: isolated synthetic database and mocked provider/payment adapters.
3. Production: real customer accounts, projects, payment states and private assets.

## Demo rules
Every screen labelled DEMO. No production D1/R2 bindings, real Duitku invoices/payments/refunds, Genspark/provider calls, email/SMS/WhatsApp, real customer data or production job creation. Demo reset is deterministic. Analytics exclude demo events from business metrics.

## Data isolation
Use static fixtures for public demo wherever possible. Staging must use separate isolated data and secrets. A demo tenant/environment marker is defence-in-depth, not permission to share production DB. Never let demo API call production mutations.

## Acceptance
Complete demo journey works; payment and production are simulated; network tests confirm no provider/payment calls; fixtures reset; no demo record appears in CRM or real analytics.