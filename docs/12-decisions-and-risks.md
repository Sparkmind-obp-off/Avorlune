# 12 — Decisions, Assumptions & Risks

## Architecture decisions
### ADR-001: Service-led portal before AI SaaS
**Decision:** MVP manages a human-in-the-loop production service.  
**Reason:** validate paid demand and operational bottlenecks before building costly automation.  
**Consequence:** production may initially happen outside the portal; the portal tracks scope, status, feedback and delivery.

### ADR-002: Modular monolith
**Decision:** one Hono API and one relational database.  
**Reason:** simplest operational footprint for an early-stage product.  
**Consequence:** maintain clear domain modules; do not prematurely split services.

### ADR-003: Cloudflare-first infrastructure
**Decision:** Pages/Workers + D1 + private R2 as initial target.  
**Reason:** low operational overhead and a coherent deployment environment.  
**Consequence:** verify platform limits, binding configuration, backups and regional/data requirements before production.

### ADR-004: Provider-agnostic AI layer
**Decision:** no provider lock-in and no assumed API access.  
**Reason:** web products, desktop tools and APIs have different capabilities, rights and costs.  
**Consequence:** integrate only after official API and commercial terms are checked.

### ADR-005: Human approval before delivery
**Decision:** every deliverable receives internal review; customer approval is recorded.  
**Reason:** protect quality, accuracy, brand safety and customer trust.

### ADR-006: Pages Functions as the API host (implemented 2026-10-31)
**Decision:** the Hono API runs as Cloudflare Pages Functions (`functions/api/[[path]].ts`) in the same Pages project as the React SPA.
**Reason:** one deploy unit, same-origin cookies (no CORS), simplest BYOK deployment.
**Consequence:** preview deployments share the production D1 binding until a separate preview database is configured — do not use preview URLs with real customer data.

### ADR-007: Customer access via signed, expiring, revocable project links (implemented 2026-10-31)
**Decision:** customers access their project with an HMAC-signed token (30-day expiry) bound to project id + `access_token_version`; admins can rotate to revoke all prior links. No customer accounts yet.
**Reason:** satisfies docs/07 ("verified, expiring, high-entropy project token") without selecting an auth provider.
**Consequence:** anyone holding a valid link can act as the customer; links are moved out of the URL into sessionStorage and pages are `noindex`/`no-referrer`.

### ADR-008: R2 asset delivery deferred (2026-10-31)
**Decision:** no R2 bucket yet; previews/finals are delivered through an external private channel while the portal records feedback and approval.
**Reason:** enabling R2 on the Cloudflare account requires owner approval (billing method on file) per the Rp0/minimal-spend principle.
**Consequence:** docs/11 "P0 — Delivery" asset items remain open and are a launch blocker.

### ADR-009: Environment identity marker + binding-less preview (2026-11-01)
**Decision:** each database is stamped `app_meta.environment`; the API refuses any request whose `APP_ENV` differs from the stamp. Preview deployments get no D1/R2 binding until a dedicated preview DB exists.
**Reason:** close G0.3 without paid resources; the account hit its D1 limit.
**Consequence:** preview URLs show the static site, and their API returns 503. A misbinding fails closed.

### ADR-010: Approval bound to a stored final asset; R2 binding named DELIVERY_BUCKET (2026-11-01)
**Decision:** approval requires a specific active final asset whose private object exists. The private bucket binding is `DELIVERY_BUCKET`, validated by duck-typing.
**Reason:** close G0.2. Cloudflare Pages already injects a static-asset Fetcher named `ASSETS`, which collided with the first binding name during local testing.
**Consequence:** without R2, portal approval is impossible by design; the pilot uses the manual procedure in docs/41.

### ADR-011: Duitku POP with a server-side settlement rule and a checkout switch (2026-11-01)
**Decision:** online payment uses Duitku POP JS. An order becomes paid only after a correctly signed callback with matching amount **and** a server-to-server `transactionStatus` = 00 with the same amount; settlement is idempotent. Customer checkout requires `DUITKU_CHECKOUT_ENABLED="true"`; it ships `false`.
**Reason:** never trust browser status; credentials could not be verified against Duitku production; live transactions need owner authorisation.
**Consequence:** the integration is deployed but dormant; manual payment confirmation (docs/44) remains the operating path until credentials verify and the owner enables checkout.

## Open assumptions
- First vertical/customer segment is not yet validated.
- Pricing and package structure are not yet validated.
- Domain and social handles are not yet verified.
- Trademark clearance is not complete.
- AI provider API access and commercial terms are not confirmed.
- Payment gateway: Duitku selected (ADR-011); production credentials not yet accepted by Duitku.
- Notification provider is not selected.

## Risk register
| Risk | Impact | Mitigation |
|---|---|---|
| Brand conflict | Rebrand/legal cost | Direct registrar, handle, PDKI and WIPO checks; counsel review |
| Weak paid demand | No viable business | Concierge pilots before platform expansion |
| Provider policy changes | Workflow disruption | Human fallback and adapter abstraction |
| Output quality inconsistency | Rework and refunds | Brief templates, internal QA, revision boundaries |
| Rights/likeness disputes | Legal/reputation harm | Customer warranties, consent and asset provenance |
| Asset leakage | Customer harm | Private storage, scoped access, expiring URLs |
| Uncontrolled generation cost | Margin loss | Per-project cost tracking and approval gates |

## Release blockers
Do not launch paid self-serve generation until provider access, pricing, output rights, safety controls and support responsibilities are verified. Do not claim legal brand clearance without official screening.
