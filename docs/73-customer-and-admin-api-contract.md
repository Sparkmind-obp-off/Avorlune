# 73 — Customer & Admin API Contract

**Status:** Target contract; adapt to existing Hono routes and preserve compatibility.

## Public
Services, service details, approved portfolio and synthetic demo. Existing inquiry endpoint remains compatible and rate-limited.

## Customer identity
GET/PATCH own profile; read/update onboarding; request account deletion. All require verified customer token and internal identity mapping.

## Customer workspace
List own projects; create/update/submit brief drafts; read own project and quote versions; accept/decline quote; read payment schedule; create checkout for due milestone; refresh payment; list/download authorized assets; submit feedback; create support ticket.

## Admin CRM
Search/detail customer; triage inquiry; clarify; create/send/supersede quote; inspect payment schedule; reconcile; create production task; update project stage; upload preview/final; record QA/provenance; release delivery; manage support; audited export. Admin routes require trusted private perimeter.

## Rules
Validate server-side; verify identity and object ownership per request; never accept customer ID, role, price, payment status or ownership from browser. Paginate; bound queries; idempotency keys; concurrency control; consistent response envelope. Preserve legacy signed project-link routes during migration.

## Payment
All paid services use 50% deposit before production and 50% balance before final delivery. Amounts derive from accepted quote server-side. Duitku credentials are LIVE/PRODUCTION; checkout stays disabled until read-only LIVE auth succeeds and owner explicitly approves. Demo never calls payment APIs.

## Acceptance
Auth, ownership, pagination, brief idempotency, quote decisions, payment milestones, legacy compatibility and perimeter isolation are contract-tested.