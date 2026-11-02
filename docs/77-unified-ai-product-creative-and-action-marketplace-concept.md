# 77 — Unified AI Product, Creative & Action Marketplace Concept

**Decision date:** 2026-11-03  
**Status:** Product direction approved for design and implementation planning.  
**Brand:** AVORLUNE  
**Customer-facing category:** AI Creative Production & Digital Creative Services.

## 1. The concept

AVORLUNE is a **curated AI Product, Creative & Action Marketplace**: one storefront where customers discover and purchase defined creative outputs, packaged digital products and outcome-based actions. AVORLUNE remains the accountable operator and fulfiller.

The marketplace experience borrows the clarity of a service marketplace—catalog, offer cards, service details, brief/configuration, quote, checkout, order tracking and reviews—but is not an open peer-to-peer marketplace. No third-party seller onboarding, freelancer bidding, public provider listings or seller payouts in the initial model.

Internal operating layer may be called the **Creative Commerce & Action Engine**. Do not market it as an AI model platform or AI SaaS.

## 2. Three commercial lanes

### A. AI Creative Production
Custom or packaged production outcomes:
- AI image production: product imagery, lifestyle visuals, campaign key visuals, social image sets.
- AI video production: short promotional videos, product clips, story-led campaign concepts.
- Campaign creative: coordinated image/video variations, format adaptations and creative sets.

### B. AI Creative Products
Ready-made, finite digital deliverables that AVORLUNE owns or is authorized to distribute:
- Brand/social templates and creative kits.
- Campaign starter kits and editable design assets.
- Content planning packs and production-ready creative documents.
- Downloadable asset bundles, only where source rights and licenses permit.

A product is a deliverable with a version, file manifest, license, format and support boundary. It is not a prompt/credit/account-access resale scheme. Do not list products until files, rights, versioning, pricing and fulfillment are real.

### C. AI Action Services
Outcome-based actions performed by AVORLUNE, not self-serve access to an AI agent:
- Convert an existing product brief into a campaign-ready creative pack.
- Repurpose approved source content into a defined set of channel assets.
- Prepare marketplace/social listing image sets from customer-provided product information.
- Produce a launch kit with defined creative deliverables.
- Generate and QA a batch of format variations.

Each action has prerequisites, inputs, output specification, scope, human checkpoints, exclusions, timing assumptions and a completion record. External account actions (publishing, ads, purchases, messaging, deleting) require explicit scoped authorization and confirmation; the MVP should prefer prepare/review/export rather than unattended publishing.

## 3. Catalog ontology

Use a single catalog with typed listings:
- `creative_service`: bespoke or configured creative production.
- `digital_product`: fixed downloadable creative deliverable.
- `action_service`: outcome-based work executed by AVORLUNE.
- `bundle`: a versioned combination of compatible listings.
- `custom_project`: quotation-led engagement.

Separate entities:
- **Catalog item:** canonical product/service definition.
- **Offer:** sellable, versioned commercial configuration for a catalog item (price mode, scope, validity, availability, terms).
- **Offer version:** immutable snapshot accepted by a customer.
- **Order/project:** customer transaction and execution record.
- **Action run:** operational execution record for an action service; never treat a prompt invocation as a completed customer outcome.
- **Deliverable:** file/output manifest with version, provenance, license, QA and release state.
- **Service log/activity event:** append-only history of customer-visible and internal events, separated by visibility.
- **Provider/tool:** internal production dependency with verified capability, plan, terms and allowed-use status.

## 4. Offer and pricing model

Support pricing modes:
- fixed price only when scope and unit economics are validated;
- starting_at only when a truthful minimum scope and conditions are explicit;
- quote_required for custom or variable work;
- free_demo for simulation only;
- internal_only for non-purchasable operational capabilities.

Every offer records currency, integer IDR minor units, inclusions, exclusions, options, revision policy, delivery assumptions, rights/license, availability, validity window and terms version. Do not invent prices or imply a binding quote from illustrative demo data.

All paid production services follow the owner-approved universal payment policy: **50% deposit before production and 50% balance before final delivery**. A digital product may eventually have a different fulfillment/payment rule only after a separate explicit owner decision; do not silently exempt any current paid service from 50/50. Until that decision, apply the existing policy or keep instant-download products disabled.

## 5. Customer experience

Browse without account → select lane/category → view listing/offer → configure or build brief → sign in before submission/private access → optional onboarding → receive quote/offer snapshot → accept → pay applicable milestone → track order/action → review preview → request revisions → balance payment → QA/provenance gate → private deliverable → support/reorder.

Customer workspace shows only own projects, purchases, quotes, payment milestones, action progress, service logs, support and authorized deliverables.

## 6. Operating model

Single provider / operator: AVORLUNE. Human-in-the-loop production is mandatory for customer-facing deliverables. Genspark is an internal human-operated tool unless official current API and terms are independently verified. Do not automate browser UI, scrape or resell credits/accounts in violation of provider terms. No tool is exposed to customers as a product.

## 7. Action marketplace guardrails

An action is a scoped service with explicit input/output and an auditable run. It is not an unconstrained agent with access to customer accounts. For any external action:
- define permitted operation and target account;
- show exact proposed change;
- obtain explicit customer authorization at execution time;
- enforce least privilege and reversible operations where possible;
- log actor, timestamp, scope, result and external reference;
- provide cancellation/rollback path where supported;
- never store customer passwords, cookies or OTPs;
- do not perform financial, publishing, messaging or destructive actions without explicit approval.

MVP action services should create deliverables or prepared drafts, not post or transact on behalf of customers.

## 8. Marketplace boundaries and future expansion

Phase 1: AVORLUNE-owned/fulfilled catalog only.  
Phase 2: validated bundles, instant digital products and more action services.  
Phase 3 (future, separate decision): vetted partner providers with contracts, moderation, liability, payout, tax, dispute, quality and compliance systems. No seller architecture should be built prematurely.

## 9. Success metrics

Qualified listing views, brief-start/completion, offer acceptance, paid conversion, delivery completion, turnaround, revision rate, margin/contribution per offer, action success/failure, repeat purchases and support load. Separate real production, internal test and demo metrics.

## 10. Product rule

Sell outcomes and deliverables customers can understand and verify. Keep catalog, offer, order, action execution, provider and deliverable records distinct so AVORLUNE can expand without turning the MVP into an unsafe general-purpose agent marketplace.
