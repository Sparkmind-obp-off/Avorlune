# 74 — Notifications, Support & Retention

**Status:** Target specification; delivery providers not yet approved.

## Events
Brief received, clarification, quote ready/expiry, deposit settled, production started, preview ready, revision update, balance due, final delivery ready, support reply and cancellation/refund update.

## Outbox
Persist customer, event, template version, channel, delivery state, bounded attempts, provider reference and safe error code. Idempotency prevents duplicates; retries are bounded. Never log provider secrets or full briefs. Start with in-app activity; add email only after provider pricing, deliverability, consent and data terms are reviewed. WhatsApp/SMS are not assumed.

## Preferences
Transactional messages required to fulfil an order are distinct from marketing. Marketing requires separate consent. Provide appropriate preference controls.

## Support
Open → awaiting customer / awaiting AVORLUNE → resolved → closed. Tickets link to customer and optionally project. Customer sees customer-visible replies only; internal notes remain private.

## Retention
Define retention periods for identity, briefs, uploads, invoices, payment evidence, support and audit. Account deletion does not erase legally required finance/audit evidence. Obtain Indonesian privacy/legal review before launch.

## Acceptance
One logical notification per event; safe retries; demo sends nothing; support ownership enforced; internal content never appears in customer response.