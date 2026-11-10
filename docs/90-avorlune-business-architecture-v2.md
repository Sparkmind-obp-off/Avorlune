# 90 — AVORLUNE Business Architecture v2

**Status:** Architecture proposal prepared from the owner's direction, 2026-11-11  
**Scope:** Brand hierarchy, business units, acquisition, affiliate operations, shared content production and system boundaries.  
**Implementation status:** Documentation only. This document does not authorize production deployment, domain/DNS changes, paid services, provider activation, migrations or public launch of new capabilities.

## 1. Executive decision

AVORLUNE remains the parent brand and primary business. It is not being replaced, paused or abandoned in favour of OLTAVYN.

The intended arrangement is:

- **AVORLUNE** — customer-facing parent brand, commercial identity, customer acquisition and business operations.
- **OLTAVYN** — existing separate codebase used as an internal technology/automation engine. It is not a separate public-facing business brand at this stage.
- **Affiliate OS** — a proposed internal operating workspace under AVORLUNE for product research, evidence, scoring, content experiments, channel operations and affiliate performance learning. It may reuse/adapt OLTAVYN's foundation after a compatibility and security review.
- **Content Factory** — the shared production capability and workflow used to create content for both AVORLUNE's own media and customer work.
- **Affiliate Media** — AVORLUNE-owned media channels that publish product-oriented content and may earn affiliate commissions.
- **Content Services / Creative Production** — paid deliverables produced for external customers.

This separates the commercial brand, internal software, production capability and revenue activities. It avoids turning every internal system into a new public brand.

## 2. Brand and system hierarchy

```text
AVORLUNE — parent brand and business
|
|-- Creative Production / Content Services
|   |-- AI video, image and campaign assets
|   |-- Customer briefs, quotes, orders and delivery
|
|-- Affiliate Media
|   |-- AVORLUNE-owned content channels
|   |-- Product discovery, evidence and affiliate links
|
|-- Content Factory
|   |-- Shared planning, scripting, asset production and QA
|   |-- Internal content and customer deliverables
|
|-- Affiliate OS (internal product / workspace; proposed)
|   |-- Product research and evidence ledger
|   |-- Product scorecards and experiments
|   |-- Channel/content planning and approvals
|   |-- Publishing records and performance learning
|
`-- OLTAVYN (internal engine / existing separate repository)
    |-- Reusable workflow, data and automation foundation
    |-- Adapt only where it fits AVORLUNE's requirements
```

The hierarchy is conceptual. It does not imply that all units already exist as deployed applications or legally separate entities.

## 3. Business units and their jobs

### 3.1 Creative Production

Purpose: acquire and serve business customers who need creative assets without building an in-house production team.

Initial offer families can include:
- AI video and short-form social content;
- AI image and product/campaign visuals;
- video ads and product showcases;
- short-form narrative/series production where scope and quality can be controlled.

The customer purchases an agreed deliverable and production service, not AI credits, provider account access or raw internal prompts. Keep AVORLUNE's existing service-led customer journey, approval gates, rights checks and payment controls as the baseline.

### 3.2 Affiliate Media

Purpose: operate AVORLUNE-owned media channels that publish useful, transparent product content and earn commissions when eligible viewers purchase through tracked affiliate links.

This is a separate revenue activity from customer production services. Its content should be useful to the audience first, disclose affiliate relationships where required, and never claim first-hand testing or experience unless it actually occurred.

### 3.3 Content Factory

Purpose: provide one repeatable production pipeline for both business units.

Shared stages:
1. Research and evidence capture.
2. Audience/problem and content angle selection.
3. Brief, hook, script and storyboard.
4. Asset sourcing or generation with permitted tools.
5. Editing, captions, audio and format adaptation.
6. Human quality, factual, rights and policy review.
7. Approval and publishing/delivery.
8. Performance observation and learning.

Shared infrastructure does not mean shared public messaging. Customer acquisition content and affiliate recommendation content must have distinct audience promises, CTAs and measurement.

### 3.4 Affiliate OS

Purpose: give the operator one internal workspace for the affiliate workflow rather than managing research and production across disconnected notes.

Proposed modules:
- channel registry and channel purpose;
- product candidates and source evidence;
- product scorecards with unknown values kept null;
- experiments and content assignments;
- script/asset/version records;
- approval and publishing log;
- affiliate-link reference (never store credentials or expose private tokens);
- outcome observations and learning summaries.

Affiliate OS is a working name for an internal tool, not a promise of a public SaaS product. A possible future address is `affiliate-os.avorlune.biz.id`, but this is **not approved for DNS, deployment or public access yet**.

## 4. Role of OLTAVYN

Keep the OLTAVYN repository for now. Do not move AVORLUNE's parent brand, customer-facing website or commercial identity into OLTAVYN.

Use OLTAVYN as a source of reusable internal technology, subject to these rules:
- inspect the current code and data model before adapting it;
- reuse proven components instead of rebuilding equivalent systems;
- keep workspace isolation, authentication, auditability and approval gates;
- do not connect live affiliate accounts or publish automatically without explicit authorization;
- do not apply migrations to production as part of this architecture document;
- do not assume an existing feature is production-ready merely because it is documented.

The previously prepared OLTAVYN Phase 1 affiliate-factory draft PR remains a separate, unmerged proposal. It must be reconciled with this AVORLUNE architecture before merge or implementation. No OLTAVYN changes are made by this document.

## 5. Customer acquisition architecture

AVORLUNE owns the customer acquisition strategy. Acquisition can serve two distinct funnels.

### Funnel A — Creative Production customers

**Audience:** sellers, small businesses, creators and brands that need visual content.

**Path:** AVORLUNE portfolio/educational content → service catalogue and examples → brief/inquiry → qualification and quote → approved production → review and delivery → repeat order/referral.

Primary CTA: explore a service, view a relevant example or submit a project brief.

### Funnel B — Affiliate Media audience

**Audience:** consumers researching useful products and practical solutions.

**Path:** product/problem content → useful explanation or comparison → transparent affiliate disclosure → tracked product destination → commission where a qualifying purchase occurs.

Primary CTA: view product details or compare options. Do not disguise affiliate content as a customer-service advertisement.

### Shared production, separate measurement

Both funnels may use the Content Factory, but measure them independently:
- customer funnel: qualified inquiries, quote acceptance, paid orders, gross margin, delivery time, repeat orders;
- affiliate funnel: qualified views, retention, product clicks, conversion evidence, commission and net contribution.

Do not count views or clicks as revenue. Keep unknown performance values null until sourced.

## 6. Revenue model

| Revenue stream | Who pays | What AVORLUNE provides | Validation priority |
|---|---|---|---|
| Creative Production | Business/customer | Agreed creative deliverables | High — existing core business |
| Affiliate Media | Affiliate program/merchant via commission | Audience attention and qualifying referrals | High — low-cost controlled experiment |
| Future internal tools/products | Only after a separate decision | Potential workflow software or licensed product | Later — not assumed revenue |

Affiliate commissions are uncertain and platform-dependent. Do not forecast guaranteed income. Keep customer payments and affiliate commission records logically separate.

## 7. Rollout plan

### Phase 0 — Architecture alignment (now)
- Keep AVORLUNE as parent brand.
- Record business-unit and system boundaries.
- Preserve existing AVORLUNE customer production roadmap and safety gates.
- Keep OLTAVYN separate and unmodified until its draft is reconciled.

### Phase 1 — Low-cost validation
- Start with a small number of clearly differentiated affiliate content experiments.
- Use permitted public product information and seller-authorized/licensed assets.
- Manually review scripts, claims, affiliate links and posts.
- Continue AVORLUNE portfolio and customer-acquisition activity in parallel.
- Track evidence and outcomes before expanding channels or volume.

### Phase 2 — Internal Affiliate OS adaptation
- Audit OLTAVYN's current implementation against the requirements in section 4.
- Map existing tables and workflows to the Affiliate OS modules.
- Identify gaps before changing schema or API.
- Implement locally/preview first, with tests and workspace-isolation checks.
- Obtain owner approval before remote migrations, production deployment or account integrations.

### Phase 3 — Operational integration
- Connect the approved internal workflow to AVORLUNE's Content Factory.
- Maintain separate customer and affiliate data boundaries.
- Add dashboards only for metrics that can be evidenced.
- Consider a private subdomain only after authentication, authorization, data protection and operational value are verified.

### Phase 4 — Expansion decision
- Expand channels, products, customer service catalogue or external software only when experiments show repeatable value and operating capacity exists.
- A public Affiliate OS/SaaS offering requires a separate product, legal, security and commercial decision.

## 8. Technology, data and security boundaries

- AVORLUNE's existing customer platform, backend and operational data remain authoritative for customer projects, quotes, payments and deliverables.
- OLTAVYN remains a separate repository and must not become a second source of truth for AVORLUNE customer orders or payments.
- Affiliate OS may own affiliate research and experiment data; it must not copy customer PII unnecessarily.
- Never put provider secrets, account passwords, private affiliate tokens or customer private assets in public repositories or browser code.
- Keep evidence provenance, content rights, approval events and audit trails.
- Use synthetic data in public demos.
- No private endpoint scraping, access-control bypass, fake engagement, fabricated product metrics, fabricated testimonials or unsupported product-use claims.
- Manual approval remains required before publishing or committing money.
- Unknown data remains null; distinguish estimates from verified results.

## 9. Cost and approval gates

Default operating constraint: validate with free or already-authorized resources first.

The following require explicit owner approval before action:
- paid APIs, scraping, AI generation, subscriptions or credits;
- billing/payment-method setup;
- live account connection or access to private account data;
- production database migrations or deployments;
- DNS, custom-domain or public access changes;
- automatic publishing, affiliate-link actions or customer-facing capability changes;
- any action that spends money or creates an external commitment.

## 10. Decision register

| Decision | Current position |
|---|---|
| Parent business brand | AVORLUNE |
| OLTAVYN | Keep as existing internal technology engine/repository |
| Affiliate OS | Proposed internal AVORLUNE workspace; not public SaaS |
| Content Factory | Shared internal production capability |
| Affiliate Media | AVORLUNE-owned media and commission activity |
| Creative Production | AVORLUNE's existing customer-facing core business |
| Affiliate OS subdomain | Candidate only; no DNS/deployment approval |
| OLTAVYN Phase 1 draft PR | Pending reconciliation; do not merge automatically |
| Paid tools and production changes | Explicit approval required |

## 11. Immediate next actions

1. Treat this document as the architecture reference for future AVORLUNE and OLTAVYN work.
2. Review the OLTAVYN Phase 1 draft PR against this document; update its docs only after identifying conflicts.
3. Audit AVORLUNE's current roadmap to ensure affiliate operations do not displace the existing creative-production customer journey.
4. Define the smallest affiliate experiment and evidence requirements before building more UI.
5. Do not configure `affiliate-os.avorlune.biz.id` until the private application has passed its security and value gates.

**Non-goal:** this document does not rename AVORLUNE, migrate repositories, merge the OLTAVYN PR, deploy a new application, activate providers or authorize public launch.
