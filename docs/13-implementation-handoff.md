# 13 — Implementation Handoff

> **HISTORICAL / PLANNING REFERENCE.** Written before implementation. The actual layout is `src/`, `server/`, `shared/`, `functions/`, `migrations/`, `tests/` (see README). Current status lives in docs/37 and docs/39.

## Purpose
This document translates the product blueprint into an implementation sequence for an AI coding agent or developer. It is not evidence that implementation or deployment has already happened.

## Repository baseline
Before implementation, inspect the current branch and file tree. Preserve existing work. The documented stack is a target architecture, not a claim that the repository already contains a working application.

## Recommended project structure
```text
/
├── AGENTS.md
├── README.md
├── package.json
├── apps/
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── features/
│       │   │   ├── public-site/
│       │   │   ├── inquiries/
│       │   │   ├── projects/
│       │   │   └── admin/
│       │   └── styles/
│       └── vite.config.ts
├── services/
│   └── api/
│       └── src/
│           ├── routes/
│           ├── middleware/
│           ├── domain/
│           ├── adapters/
│           └── index.ts
├── packages/
│   └── shared/
│       └── src/
├── db/
│   └── migrations/
├── tests/
│   ├── unit/
│   └── integration/
└── docs/
```

Adjust the layout if the repository already has a coherent structure; do not reorganize for aesthetics alone.

## Implementation sequence

### Milestone 1 — Application foundation
- Initialize or verify TypeScript workspace and package scripts.
- Add frontend and API health endpoint.
- Configure local development and environment validation.
- Add lint, typecheck and test commands.
- Document Cloudflare bindings without committing secrets.

**Exit criteria:** app starts locally; health endpoint works; typecheck and baseline tests pass.

### Milestone 2 — Public website
- Home, services, portfolio, process, FAQ, contact, privacy and terms.
- Responsive navigation and accessible layout.
- Only use original or properly licensed portfolio assets.
- Clear CTA to start a project.

**Exit criteria:** public pages are responsive, accessible and contain truthful copy.

### Milestone 3 — Inquiry pipeline
- Inquiry schema and server-side validation.
- Spam/rate-limit controls.
- D1 migration and repository layer.
- Public reference generation.
- Confirmation state and admin inbox.

**Exit criteria:** a valid inquiry persists once; invalid requests are rejected; no private information is exposed.

### Milestone 4 — Admin and project lifecycle
- Admin authentication and role checks.
- Project list/detail.
- Quote and scope records.
- Controlled status transition service.
- Audit event recording.

**Exit criteria:** admin can manage a project; unauthorized users cannot access admin data; invalid transitions are rejected.

### Milestone 5 — Asset delivery and feedback
- Private R2 bucket.
- Upload-intent and completion verification.
- Preview/final classification.
- Short-lived authorized download.
- Feedback and approval records.

**Exit criteria:** project asset isolation tests pass; expired access is denied; customer approval is recorded.

### Milestone 6 — Production hardening
- Error handling, structured redacted logs, backup plan.
- Privacy/retention/deletion procedures.
- Security and accessibility review.
- Preview deployment and smoke tests.
- Production release only after checklist approval.

**Exit criteria:** launch-readiness checklist is satisfied and all release blockers are resolved.

## Environment variables and bindings
Create a validated environment schema. Document variable names and purpose in `.env.example`; use safe placeholders only. Store real values using Cloudflare secrets or a suitable secret manager.

Expected configuration categories:
- application environment and public base URL
- D1 binding
- private R2 bucket binding
- admin authentication/session secret
- allowed origins
- notification provider credentials (optional, later)
- AI provider credentials (optional, later)

Never commit real credentials. Do not add unused secrets just because they may be useful later.

## Definition of implementation complete
- A user can submit an inquiry.
- An authorized producer can qualify and quote it.
- Project state is tracked with an audit trail.
- Assets are privately stored and correctly authorized.
- A customer can review, provide feedback, approve and download deliverables.
- Critical paths have automated tests.
- Deployment and operational instructions are accurate.
