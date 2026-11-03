# 87 — Data, API and Technical Requirements

**Status:** Target specification. Reuse current schema and API where possible; audit before adding migrations.

## 1. Domain entities

Keep these concepts separate:
- `catalog_items`: canonical service/product/action definition.
- `offers`: purchasable configuration and pricing mode.
- `offer_versions`: immutable snapshot accepted by customer.
- `offer_options`: configurable add-ons and constraints.
- `orders/projects`: customer transaction and lifecycle.
- `order_briefs`: versioned customer inputs and scope.
- `generation_jobs`: durable generation orchestration.
- `provider_registry`: approved provider and capability metadata.
- `provider_job_attempts`: provider request references, attempts and normalized results.
- `assets`: private input, preview and final output metadata.
- `deliverable_manifests`: accepted outputs, version, provenance, license and QA.
- `usage_ledger`: estimated/actual provider usage and direct cost.
- `quality_reviews`: automated and human review outcomes.
- `order_events`: append-only lifecycle and audit events.

Reuse existing `projects`, `quotes`, `payments`, `payment_orders`, `assets`, `project_costs`, `project_events`, `users` and `sessions` where appropriate. Do not duplicate existing business records.

## 2. Core invariants

- Every order belongs to one verified customer identity.
- Accepted order stores immutable offer and brief snapshots.
- Generation jobs are idempotent and linked to one order.
- Provider attempts cannot change customer-approved scope.
- Provider secrets and raw credentials never enter D1.
- Customer can access only own orders and assets.
- Internal prompts, provider logs, costs and moderation notes are not customer-visible by default.
- A preview is not a final deliverable.
- Final delivery requires payment, QA, provenance/license and ownership gates.
- Demo records are synthetic and physically/logically isolated.

## 3. Suggested API surface

Public:
- `GET /api/v1/catalog`
- `GET /api/v1/catalog/:slug`
- `GET /api/v1/offers/:id`

Customer:
- `POST /api/v1/orders/drafts`
- `PATCH /api/v1/orders/:id/brief`
- `POST /api/v1/orders/:id/submit`
- `GET /api/v1/orders`
- `GET /api/v1/orders/:id`
- `POST /api/v1/orders/:id/payment/checkout`
- `POST /api/v1/orders/:id/feedback`
- `POST /api/v1/orders/:id/revision-requests`
- `GET /api/v1/orders/:id/deliverables`

Internal/admin:
- `POST /api/v1/internal/orders/:id/queue`
- `POST /api/v1/internal/generation-jobs`
- `GET /api/v1/internal/generation-jobs/:id`
- `POST /api/v1/internal/generation-jobs/:id/retry`
- `POST /api/v1/internal/generation-jobs/:id/cancel`
- `POST /api/v1/internal/quality-reviews`
- `POST /api/v1/internal/deliverables/:id/release`
- `GET /api/v1/internal/usage-ledger`

These are logical contracts, not authorization to create duplicate routes. Align with current API conventions and docs 64, 73 and 78.

## 4. Job state machine

`created → validated → queued → submitted → processing → output_received → quality_review → preview_ready → customer_revision (optional) → approved → final_released`

Terminal/error states: `failed`, `cancelled`, `blocked_rights`, `blocked_payment`, `needs_operator`.

Every transition must be validated server-side and recorded. Provider callbacks must be authenticated and idempotent.

## 5. Technical stack baseline

Preserve current Cloudflare-first implementation unless an audit demonstrates a concrete blocker:
- React + Vite + TypeScript customer frontend;
- Hono on Cloudflare Pages Functions / Workers API as currently implemented;
- Cloudflare D1 for operational metadata;
- private R2 for customer inputs and deliverables;
- Clerk customer authentication (Development currently; production cutover separate);
- server-side provider adapters and durable job orchestration;
- test suite with D1/R2 test doubles and provider mocks.

Do not add paid infrastructure or provider APIs without owner approval. Do not expose provider secrets in Vite variables.

## 6. Non-functional requirements

- server-side authorization and ownership checks;
- strict schema validation;
- idempotency for order/payment/job submissions;
- bounded provider retries and cost limits;
- private object storage and signed/authorized downloads;
- audit events for payment, generation, review and release;
- accessible responsive UX;
- structured logs with secrets and personal data redacted;
- migrations additive and rollback documented;
- no fake provider results in production.

## 7. Testing

Test customer isolation, invalid offer version, scope tampering, duplicate submission, duplicate provider callback, timeout/retry, provider outage, cost ceiling, malformed output, rights block, payment not settled, QA rejection, final release denial, private asset access and demo/production isolation.
