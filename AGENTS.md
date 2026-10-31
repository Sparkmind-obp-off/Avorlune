# AVORLUNE — Repository Agent Instructions

These instructions apply to every AI coding agent and contributor working in this repository.

## Project identity
- Product/brand: AVORLUNE (working name; not legally cleared).
- Customer-facing category: AI Creative Production.
- Initial services: AI image production and AI video production.
- Product direction: service-led production portal with human creative direction and quality approval.
- This repository is independent. Do not mix it with HOLBERY or the private Bosku Cukur / Bozq One System.

## Before making changes
1. Read `README.md`, `docs/MASTER-SYSTEM-PROMPT.md`, and the relevant architecture/product documents.
2. Inspect the current repository, branch, package scripts, bindings and existing implementation. Never assume the repo is empty or that a planned stack is already installed.
3. Identify whether the task is documentation, implementation, infrastructure or operations.
4. State material assumptions. Ask only if a missing decision blocks safe progress.
5. Prefer small, coherent, reviewable changes.

## Engineering constraints
- Planned default stack: React + Vite + TypeScript; Hono + TypeScript on Cloudflare Workers; D1; private R2.
- Treat the stack as a documented direction, not proof that infrastructure exists.
- Keep the first implementation a modular monolith.
- Validate all inputs on the server.
- Enforce authorization on every protected operation.
- Keep R2 private and scope access to the owning project.
- Never expose secrets, provider keys or internal storage keys to the browser.
- Do not add paid services, paid API usage or infrastructure spend without explicit user approval.
- Do not assume that a web/desktop creative tool exposes an API or permits commercial use.
- Add an AI provider only after official API, account access, pricing, data policy and commercial terms are verified.

## Quality requirements
- TypeScript strictness where practical.
- Unit and integration tests for critical business logic.
- Tests for authorization, project isolation, upload constraints and status transitions.
- Accessible semantic UI and responsive behavior.
- Handle loading, empty, error and success states.
- No fake metrics, placeholder testimonials presented as real, fabricated customer work or invented prices.
- Do not claim a test, deployment, integration or payment is successful unless verified.

## Data and privacy
- Customer briefs, uploads, previews and final assets are confidential by default.
- Never commit customer files, credentials, tokens, cookies or production data.
- Redact personal data and secrets from logs.
- Use synthetic fixtures for tests.
- Document retention, deletion and consent behavior before production launch.

## Git workflow
- Preserve user work and inspect diffs before commits.
- Use descriptive commit messages.
- Do not force-push, rewrite history or delete resources without explicit instruction.
- Do not claim deployment merely because a commit was pushed.
- Update docs when behavior or architecture changes.

## Completion report
At the end of a task, report:
1. What changed and why.
2. Exact files changed.
3. Commands/tests actually run and their outcomes.
4. Any unverified assumptions or blockers.
5. Whether changes were committed/pushed/deployed (only if true).
