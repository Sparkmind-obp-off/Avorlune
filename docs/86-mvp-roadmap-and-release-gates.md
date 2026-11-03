# 86 — MVP Roadmap and Release Gates

**Status:** Proposed execution sequence based on current repository state. Audit implementation before coding.

## Product outcome

A customer can choose a clearly scoped AI creative offer, submit source material and creative requirements, pay, track generation, review output and receive final assets without sourcing a freelancer or operating the underlying AI tools.

## Phase 0 — Audit and commercial validation

- Reconcile current implementation against docs 55–85.
- Inventory catalog, auth, order, payment, storage, job and admin capabilities.
- Identify which existing routes and tables can be reused.
- Test candidate provider workflows and commercial rights.
- Run cost/quality benchmarks for one video offer and one image offer.
- Select a narrow initial audience and launch offers.
- Keep unverified listings hidden.

**Exit:** implementation gap report, provider evidence, cost model, approved offer scope.

## Phase 1 — Catalog and self-serve ordering

- Public catalog and detail pages.
- Offer versions and configuration.
- Brief builder adapted to video/image.
- Durable order summary and customer account.
- Fixed-price only where validated; otherwise quote-required.
- Clear status and notification surfaces.

**Exit:** end-to-end test order in isolated development environment.

## Phase 2 — Production job engine

- Durable generation jobs.
- Provider adapter for one verified capability.
- Cost/usage ledger and retry controls.
- Private staging storage.
- QA checklist and preview generation.
- Operator exception queue.

**Exit:** successful repeatable batch with recorded cost, quality and failure rate.

## Phase 3 — Payment and delivery

- Verify payment milestones and callback behavior.
- Deposit before production; balance before final release.
- Private file storage and ownership checks.
- Customer preview, revision and final download.
- Refund/cancellation and support flows.

**Exit:** payment sandbox and controlled production tests pass; security and legal gates approved.

## Phase 4 — Limited public launch

- Publish only proven offers.
- Set order capacity and daily spend caps.
- Support process and incident monitoring.
- Collect customer feedback and unit economics.
- Review first 10–20 paid orders before expanding.

**Exit:** positive contribution on a repeatable offer, acceptable QA, on-time delivery and manageable support.

## Phase 5 — Expand carefully

- Additional provider adapters only where a capability gap exists.
- Content packs and repeat purchase plans.
- More image/video formats.
- Customer-side saved brand kits and reusable briefs.
- Automated low-risk QA and provider routing.

Third-party sellers/freelancers are outside the approved initial roadmap and require a separate business and legal decision.

## Release gates

No production launch until:
- provider use and commercial rights are verified;
- secrets and private files are protected;
- price and capacity are validated;
- payment and refund behavior are tested;
- legal pages and customer terms are approved;
- customer data isolation and authorization tests pass;
- rollback, backup and incident procedures exist.

## North-star and guardrail metrics

North-star: paid orders delivered with accepted quality, on time and positive contribution.

Guardrails: provider spend, cost per accepted asset, failed generation rate, revision rate, refunds, support load, data/privacy incidents and customer complaints.
