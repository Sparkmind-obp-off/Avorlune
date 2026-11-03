# 54 — Unified Public ↔ Admin Architecture & External Capability Contract

This document aligns the Public application with the owner-approved Admin/Super Admin architecture. The controlling cross-repository decision is Admin-overlune/docs/31; the implementation prompt is Admin-overlune/docs/32.

## Canonical product boundary
- Public AVORLUNE is the customer-facing creative production storefront and workspace.
- Admin/Super Admin is a separate private frontend in the Admin-overlune repository.
- Both surfaces use one authoritative backend API and one operational D1 database. The current backend baseline remains in this Public repository until a deliberate, tested extraction.
- Admin must not create a competing API, D1 database, order store or provider registry.
- Public and Admin are separate trust zones, not separate businesses.

## Current implementation vs target
The current repository and deployed environment must be audited before migration. Existing /admin routes and first-party admin operations are legacy baseline functionality until equivalent Admin-overlune functionality is implemented, security-tested and migrated. Do not remove working routes or run two active Admin control planes at once. Document each migration cutover and rollback.

The architecture target does not mean the Admin frontend, shared API extraction, agent runtime, Clerk integration, R2 production storage or external providers are already implemented. Verify code and deployed resources independently.

## Shared backend contract
The backend remains the single authority for:
- customers, projects, inquiries, quotes, orders and payment state;
- production tasks, customer conversations, revisions and delivery;
- public capability catalogue and published versions;
- provider profiles, opaque secret references and connection lifecycle;
- agent tasks, typed tool execution, approvals and audit;
- generation jobs, asset metadata, quota and budget enforcement.

Admin reads and mutates permitted data through privileged API routes. Public uses customer/public routes. Never give either frontend direct D1/R2 access. Every privileged request must enforce Admin authentication and authorization server-side. Customer JWT/project token cannot authorize Admin routes.

## Capability and provider boundary
The backend owns provider adapters and capability routing. Public sees only a safe published capability description, customer-facing price/estimate, eligibility and availability. It never receives internal provider name/model routing, credentials, provider costs, private prompts, internal notes or policy rules.

External stack categories may include LLM/model inference, agent orchestration, web/search/research, coding assistance, chat/support, image/video/audio generation, notifications, analytics, observability and scheduling. No provider is mandatory. Select one only after a concrete gap is identified and official API access, permissions, data handling, pricing, commercial rights, rate limits and reliability are verified. Keep provider integrations replaceable and avoid overlapping services.

## Agentic control
The Admin agent can inspect authorized shared records, analyze, prepare proposed changes, execute policy-approved typed tools, verify results and monitor jobs. It cannot bypass backend authorization. Consequential operations require fresh human approval. Public customers cannot access agent tools or provider configuration.

## Customer payment and asset invariants
- Customer services retain the approved 50% deposit before production and 50% balance before final delivery.
- There is no Admin/platform billing, subscription or payment product.
- Duitku customer checkout remains disabled pending LIVE authentication verification and explicit owner approval.
- Private R2 provisioning/activation requires owner approval. Until then, do not claim private upload/delivery is live.
- Provider generation cost must be capped and approved before a job can incur paid spend.

## Optional video and chat
Public customer chat is scoped to the customer's own project. Admin agentic chat is a separate privileged operator interface. Video/image/audio capabilities remain hidden or request-only until a provider route is approved, tested, priced, rights-reviewed and backed by private storage and recovery. A human-assisted production path is acceptable before automated generation.

## Migration acceptance
1. Public continues to operate against the authoritative backend.
2. Admin-overlune authenticates separately and accesses the same records through privileged API.
3. Customer and Admin authorization are independently tested, including negative tests.
4. Legacy Admin routes are retired only after migration evidence and rollback plan.
5. Capability publication is versioned, approval-gated and customer-safe.
6. No duplicate database, secret exposure, uncontrolled paid generation or conflicting Admin runtime exists.
