# 75 — Full-Stack Roadmap & Release Gates

**Status:** Approved execution blueprint; not evidence of implementation.

1. **Audit:** inspect repository, routes, migrations, live schema, bindings, Clerk configuration, admin protection and tests read-only.
2. **Customer identity:** Clerk customer-only, internal mapping, /me, ownership middleware, skippable onboarding, guest draft preservation, signed-link compatibility.
3. **Customer portal:** catalog, service detail, brief builder, drafts, dashboard, quotes, payment milestones, timeline, preview/revisions and deliverables.
4. **CRM:** customer 360, queues, search, tags, notes, events, support, payment and production actions.
5. **Demo:** synthetic public journey and isolated staging; prove no production/payment/provider access.
6. **Payments/delivery:** additive 50/50 schedule, legacy compatibility, mocked tests, unchanged LIVE auth gate, private R2 only after billing approval.
7. **Operations:** notifications, retention, deletion, audit, backup/restore and legal review.

## Gates
G0 repository/schema audit; G1 customer auth/ownership; G2 customer portal; G3 admin perimeter; G4 demo isolation; G5 mocked payment milestones and separately verified LIVE auth; G6 private asset delivery; G7 legal/privacy, backups, monitoring and owner acceptance.

Do not enable billing, provision R2, create real payment transactions, migrate production D1, remove current admin auth or deploy breaking cutover without explicit approval and rollback. Prefer existing Cloudflare stack and minimum cost.

Definition of done: code, schema, UI, API, auth, tests, docs and deployment evidence agree.