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

## Open assumptions
- First vertical/customer segment is not yet validated.
- Pricing and package structure are not yet validated.
- Domain and social handles are not yet verified.
- Trademark clearance is not complete.
- AI provider API access and commercial terms are not confirmed.
- Payment gateway choice and credentials are not confirmed.
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
