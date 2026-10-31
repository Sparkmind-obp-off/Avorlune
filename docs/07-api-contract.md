# 07 — API Contract (Initial)

Base path: `/api/v1`. JSON responses. All endpoints must validate inputs and return consistent error objects.

## Response conventions
Success: `{ "data": ..., "requestId": "..." }`  
Error: `{ "error": { "code": "VALIDATION_ERROR", "message": "..." }, "requestId": "..." }`

## Public endpoints
- `GET /health` — service health only; no secrets or infrastructure detail.
- `GET /services` — published service catalogue.
- `GET /portfolio` — approved public samples only.
- `POST /inquiries` — create inquiry; rate-limited and spam-protected.

## Customer endpoints
- `GET /projects/:reference` — authorized project summary.
- `GET /projects/:reference/assets` — authorized asset metadata and temporary access URLs.
- `POST /projects/:reference/feedback` — submit feedback.
- `POST /projects/:reference/approval` — approve a customer-review deliverable.

## Admin endpoints
- `GET /admin/projects` — filter and paginate project inbox.
- `GET /admin/projects/:id` — project detail.
- `PATCH /admin/projects/:id` — update scope/status using allowed transitions.
- `POST /admin/projects/:id/quotes` — create or send quote.
- `POST /admin/projects/:id/assets/upload-intent` — authorize private upload.
- `POST /admin/projects/:id/assets/complete` — verify uploaded object and register metadata.
- `POST /admin/projects/:id/payments/confirm` — record authorized manual confirmation.
- `POST /admin/projects/:id/events` — restricted operational event recording.

## Status transition policy
- inquiry → qualifying → quoted
- quoted → awaiting_payment or queued (only if payment policy permits)
- awaiting_payment → queued after confirmed payment/approved exception
- queued → producing → internal_review → customer_review
- customer_review → revision or approved
- revision → producing
- approved → delivered
- eligible active states → cancelled with reason

Reject invalid transitions server-side. Never allow a browser to set arbitrary status or payment state.

## Security requirements
- Customer access must be tied to authenticated identity or verified, expiring, high-entropy project token.
- Admin endpoints require admin/producer role and CSRF protection when cookie sessions are used.
- Upload intents must be short-lived and restricted to a single project, object key, MIME type and maximum size.
- Use idempotency keys for actions that may be retried.
- Do not expose internal database IDs in public references.
