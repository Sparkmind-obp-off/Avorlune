# AVORLUNE — External Provider & Operations Register

**Status:** Architecture register; provider activation is tracked separately  
**Principle:** Use the smallest provider set that supports a safe paid customer journey. Do not add a vendor merely because it is available.

## 1. Provider matrix

| Provider/service | Purpose | Priority | Current state / decision |
|---|---|---|---|
| Cloudflare Pages | Customer and admin frontend hosting | Required | Current customer/admin are still in one Pages project; two-deployment split is target |
| Cloudflare Workers + Hono | Shared backend API | Required | Current API is Pages Functions/Hono; standalone Worker API is target, not yet deployed |
| Cloudflare D1 | Application data | Required | Existing production database; retain it |
| Cloudflare R2 | Customer uploads, private previews and final assets | **Required before private file delivery** | Code binding exists; production bucket not provisioned; activation waits for owner billing approval |
| Clerk | Customer authentication only | Required for account sign-in rollout | Planned; do not use for admin |
| First-party AVORLUNE admin auth | Private admin login | Required | Existing single-admin password-hash/session implementation is baseline; move to separate admin deployment later |
| Duitku POP JS | LIVE payment | Required for online checkout | Production integration deployed with checkout OFF; production auth diagnostic remains unresolved |
| Genspark.ai | Initial creative production workflow | Required operational tool | Human-operated production process; no API availability or commercial rights assumed |
| Resend | Transactional email | Recommended next | Not integrated; free plan currently advertises 3,000 emails/month and 100/day; verify limits and sender-domain requirements before use |
| Sentry | Error monitoring and diagnostics | Recommended, not launch-blocking if Cloudflare observability is adequate | Not integrated; supports Cloudflare Workers and Hono; DSN/configuration required |
| Cloudflare Observability / Workers Logs | Runtime logs and basic observability | Required baseline | Configure retention, sampling and alert review; check current account plan and ingestion pricing |
| External uptime monitor (e.g. Better Stack or UptimeRobot) | Independent availability checks | Optional | Defer until launch rehearsal; choose only after pricing/region/alert-channel review |
| Cloudflare DNS | Domain routing and TLS | Required when custom domains are adopted | Use current Pages/Worker hostnames until custom domains are configured |
| Legal/accounting professional | Terms, privacy, refunds, tax and merchant compliance | Required before unrestricted public paid launch | Policies remain draft pending qualified review |

## 2. Recommended minimum stack

Keep:
- Cloudflare for hosting, API runtime, database, storage and DNS.
- Clerk for customer login only.
- AVORLUNE first-party authentication for admin only.
- Duitku LIVE for payments.
- Genspark.ai for the initial human-operated creative workflow.

Add later:
- Resend for reliable transactional email (order updates, payment receipt/confirmation, production status, delivery, support).
- Sentry if Cloudflare logs/observability do not provide sufficient error grouping, alerting and debugging.
- Independent uptime monitor only when the production domain and API are stable.

Do not add Supabase, Firebase, a second database, a second payment gateway, a queue vendor, analytics suite or CRM until a demonstrated requirement justifies it.

## 3. Resend activation requirements

Before integration:
- Verify current plan, sending quota, daily limits and overage behavior.
- Verify AVORLUNE sender domain ownership.
- Configure SPF, DKIM and DMARC according to Resend's current instructions.
- Store the API key as a backend secret only.
- Use transactional email only for operational/customer lifecycle messages; marketing campaigns require separate consent and unsubscribe compliance.
- Implement delivery events, bounce/complaint handling, idempotency and retry queue.
- Keep a manual WhatsApp/email fallback while provider delivery is not verified.

Do not send payment secrets, full project tokens, or private download URLs that remain valid indefinitely in email. Use short-lived or authenticated customer portal links.

## 4. Sentry activation requirements

Sentry is recommended, not a hard prerequisite if Cloudflare's native observability is enough for the current low-volume pilot.

If adopted:
- Create separate projects/environments for production and preview where practical.
- Configure the appropriate Cloudflare Workers/Hono SDK and frontend SDK only where useful.
- Store DSN/configuration in the appropriate environment; DSN is public-facing configuration, but auth tokens remain secret.
- Set conservative tracing/sample rates to control ingestion.
- Scrub email, phone, customer briefs, payment details, cookies, authorization headers, project tokens and signed URLs before sending events.
- Use request IDs to correlate Sentry events with safe server logs.
- Test one synthetic error, verify capture, then remove the test route.
- Define who receives alerts and what severity requires action.
- Recheck Sentry plan quotas and pricing before enabling paid features.

## 5. Operational capabilities still needed

These are capabilities, not necessarily separate paid vendors:

1. **Email notifications:** customer event templates, delivery state, retries, bounce/complaint handling.
2. **Monitoring and alerting:** API errors, callback failures, checkout failures, R2 storage failures, elevated 5xx, login abuse.
3. **Backup and recovery:** scheduled D1 exports/Time Travel review, restore drills to a separate database, R2 retention/backup strategy for critical final assets.
4. **Secrets management:** inventory, rotation owner, environment isolation, no secrets in Git or logs.
5. **Refund/cancellation operations:** customer-facing policy, admin recording, Duitku portal manual refund procedure, evidence trail.
6. **Customer support:** ticket/contact route, response target, complaint/escalation and status communication.
7. **Legal/compliance:** privacy, terms, service scope, rights/licensing, cancellation/refund, retention/deletion and merchant compliance review.
8. **Creative asset rights:** source provenance, commercial-use terms, client permission for portfolio, model/provider restrictions.
9. **Cost control:** monthly review of Cloudflare, R2, email, monitoring and creative-provider usage.
10. **Production release checklist:** payment verification, private delivery, restore evidence, monitoring, support readiness and rollback.

## 6. Secrets and environment ownership

- Customer Clerk secret key: backend secret only.
- Clerk publishable key: customer frontend only.
- Admin password hash/session secret: backend secrets only.
- Duitku merchant API key: production backend secret only.
- Resend API key: backend secret only.
- Sentry auth token: CI/deployment secret if needed; never frontend.
- R2 credentials: avoid S3 access keys where Workers R2 binding suffices. Use binding-based access for the application.
- Preview must not inherit production D1, R2, Clerk secret, admin secret or Duitku credentials.

## 7. Provider activation and cost approval

No provider subscription, paid plan, add-on, billing enablement, bucket creation that requires billing, or usage-based spend is authorised by this document. The owner must approve any chargeable activation after seeing the current price and expected usage.

## 8. Readiness status

The project should not be called fully production-ready until:
- R2 private delivery is active and tested.
- Duitku LIVE production auth and one owner-approved live payment are verified.
- Customer Clerk auth is integrated and tested.
- Separate admin deployment and private auth are deployed and tested.
- Transactional customer notifications are reliable or a documented manual fallback is accepted.
- Monitoring, alerting and recovery procedures are exercised.
- Customer policies and service terms are reviewed.
- Customer support, refunds, asset rights and cost controls are operational.
