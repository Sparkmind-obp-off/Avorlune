# 84 — AI Provider Orchestration Architecture

**Status:** Target architecture; integrations are enabled only after verification and owner approval.

## 1. Purpose

Provide a software-controlled production pipeline that selects and invokes approved AI tools/providers to generate creative assets from customer orders. AVORLUNE owns the customer experience, workflow, order state, QA policy and deliverable release.

## 2. Architectural rule

**Customer → AVORLUNE catalog/order API → production orchestrator → approved provider adapter(s) → asset processing/QA → private delivery.**

The customer does not need provider accounts, provider credentials or direct access to the provider UI. Provider APIs and tools are internal dependencies.

## 3. Provider registry

Each provider capability record contains:
- provider and product name;
- capability types (text, image, video, audio, editing, upscaling);
- supported input/output formats and constraints;
- official API availability and documentation URL;
- authentication mode and secret reference (never secret value);
- plan/price and metering unit;
- rate/queue limits;
- commercial-use and output-rights evidence;
- data retention/training terms;
- geographic and content restrictions;
- reliability/latency observations;
- status: proposed, testing, approved, active, paused, retired;
- last verification date and owner approval.

A provider is not marked active until its API/authorized workflow, terms, cost, rights and operational fallback have been tested.

## 4. Adapter contract

Each adapter implements typed operations:
- capability discovery;
- validate request;
- estimate cost/usage where supported;
- submit generation job;
- poll or receive completion;
- cancel where supported;
- retrieve output;
- normalize provider errors;
- return usage and provenance metadata.

Provider-specific payloads remain inside adapters. The core order domain uses normalized job and asset records. Do not hard-code a provider's response schema throughout the application.

## 5. Orchestration lifecycle

1. Validate accepted order and payment milestone.
2. Validate source asset access and rights declaration.
3. Resolve offer version and generation specification.
4. Select an approved capability/provider based on policy, quality, availability and estimated cost.
5. Create durable job and idempotency key.
6. Submit provider request.
7. Record provider job reference and status.
8. Poll/webhook safely with signature verification where available.
9. Retrieve output into private staging storage.
10. Validate file signature, size, dimensions, duration and malware/content policy.
11. Run QA checks and human review according to risk tier.
12. If failed, retry within bounded policy or route to exception queue.
13. Create versioned deliverable manifest and provenance record.
14. Release preview/final asset according to payment and approval gates.

## 6. Provider selection

Selection policy can consider:
- task capability and output requirements;
- commercial-use eligibility;
- quality benchmark;
- estimated cost per accepted asset;
- latency and availability;
- data handling and geography;
- customer-specific restrictions;
- failure/retry behavior.

Do not select solely on lowest generation price. Cost per accepted deliverable is the relevant metric.

## 7. Genspark and UI-operated tools

Genspark may be used as an internal production tool only within its permitted terms and available capabilities. Do not assume a public API exists. Do not automate browser UI, bypass access controls, scrape, share accounts or resell credits contrary to provider terms. If an official supported API is unavailable, use a permitted human-operated workflow with an explicit operator task and status; do not pretend the pipeline is fully automated.

## 8. Reliability and cost controls

- durable job queue and idempotency;
- bounded retries and timeouts;
- per-order and per-provider usage ceilings;
- concurrency limits;
- circuit breaker and provider pause switch;
- cancellation and stale-job recovery;
- cost estimate vs actual usage ledger;
- dead-letter/exception queue;
- no unbounded agent loops;
- alerting for provider failures and spend anomalies.

## 9. Security

Provider secrets stay server-side in Cloudflare secrets or an approved secret manager. Never return them to browser code, logs, error payloads or customer support views. Validate callbacks, scope provider permissions, redact prompts/source metadata where required, and separate customer content from provider operational metadata.

## 10. Provider activation gate

Before enabling a provider in production, record:
- official docs and API/authorized method;
- successful test job;
- commercial rights/terms review;
- price and unit calculation;
- privacy/data-processing review;
- output quality benchmark;
- failure and refund procedure;
- rate limits and budget cap;
- owner approval.

## 11. MVP constraint

Start with one verified production path per launch service. Do not integrate many providers speculatively. If an offer cannot be fulfilled reliably through a supported workflow, keep it hidden or quote-required.
