# AVORLUNE
### AI Creative Production

AVORLUNE is an AI-assisted creative production studio for businesses, creators, and brands that need high-quality visual content without building an in-house production team.

**Initial services**
- AI video production
- AI image production
- Campaign and social-media creative assets

**Product strategy:** start as a service-led production platform. Customers submit a brief, the team scopes and produces the work with a human-in-the-loop workflow, and customers receive approved deliverables. Do not position the customer-facing product as an AI model company or generic AI SaaS.

> Brand status: working name. Domain, social handles, and trademark clearance remain subject to direct verification. No legal clearance is claimed.

## Repository map
- `docs/01-business-and-brand.md` — positioning, audience, offer and business model
- `docs/02-product-requirements.md` — PRD and MVP scope
- `docs/03-north-star-and-metrics.md` — North Star and measurement
- `docs/04-user-experience.md` — journeys, information architecture and UI direction
- `docs/05-technical-architecture.md` — system architecture and stack
- `docs/06-data-model.md` — database entities and relationships
- `docs/07-api-contract.md` — initial API contract
- `docs/08-ai-production-workflow.md` — provider-agnostic creative workflow
- `docs/09-security-and-privacy.md` — security baseline
- `docs/10-roadmap.md` — phased delivery plan
- `docs/11-mvp-backlog.md` — implementation backlog and acceptance criteria
- `docs/12-decisions-and-risks.md` — architecture decisions and open risks
- `docs/MASTER-SYSTEM-PROMPT.md` — operating prompt for product and engineering work

## Principles
1. Validate demand before paying for infrastructure or API usage.
2. Keep a human approval gate before delivery.
3. Never expose provider keys or private production assets to the browser.
4. Keep provider integrations behind adapters; never assume a tool has a usable API or commercial-use rights.
5. Build the smallest useful product and measure paid demand, turnaround time, quality and repeat orders.

## Initial technical direction
Cloudflare-first: React + Vite + TypeScript frontend, Hono API on Cloudflare Workers, D1 for relational data, R2 for private assets. Add Queues only when asynchronous production jobs justify them. Keep the provider layer replaceable.

## Status
Planning baseline created. Implementation, deployment, payment activation, provider API access, and trademark/domain clearance are not yet verified.
