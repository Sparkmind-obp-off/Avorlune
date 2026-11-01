# 40 — Runbook: Environment Isolation (A1)

**Status:** Implemented and verified 2026-11-01 (commit `d37b09b`). Owner: admin/operator.

## Design (three independent barriers)
1. **Binding isolation.** `wrangler.jsonc` → `env.preview` declares `APP_ENV=preview` and **no** `d1_databases` / `r2_buckets`. Pages env bindings are not inherited, so preview deployments cannot reach the production D1.
2. **Runtime env guard** (`server/middleware/envGuard.ts`). Every API request requires `APP_ENV` ∈ {production, preview, development, test} **and** `app_meta.environment` in the bound database equal to `APP_ENV`. No DB → `503 DATABASE_UNAVAILABLE`; mismatched/unstamped DB → `503 ENV_MISMATCH`. Fail closed.
3. **Static guard** (`tests/unit/config.test.ts`) fails `npm run check` if the production D1 id/name ever appears in `env.preview`, or preview gets an R2 binding.

## Database stamps
| Database | Stamp | How |
|---|---|---|
| `avorlune-production` (52632cba…) | `production` | `npm run db:stamp:prod` (done 2026-11-01) |
| local dev (`.wrangler/state`) | `development` | `npm run db:stamp:local` |
| automated tests (in-memory) | `test` | `tests/helpers/app.ts` |

The stamp uses `INSERT OR IGNORE`, so re-running never overwrites. Never stamp a non-production DB as `production`.

## Why there is no preview D1 yet
`wrangler d1 create avorlune-preview` failed 2026-11-01: *"You have reached the maximum number of D1 databases for your account"* (Workers Free plan). A slot needs the owner to delete an unused database in the account or approve a paid plan. Neither was done (Rp0 rule; no deletion of other projects' resources). **Interim control:** preview has no database and its API returns 503.

## Enabling a preview database later
1. Owner frees a slot or approves a plan change.
2. `npx wrangler d1 create avorlune-preview` → add under `env.preview.d1_databases` (binding `DB`).
3. `npx wrangler d1 migrations apply avorlune-preview --remote`
4. Stamp: `npx wrangler d1 execute avorlune-preview --remote --command "INSERT OR IGNORE INTO app_meta (key,value,updated_at) VALUES ('environment','preview',datetime('now'))"`
5. Set preview-only secrets with values different from production (dashboard → Settings → Variables → Preview). Never copy production rows into preview.
6. `npm run deploy:preview`; verify preview `/api/v1/health` = 200 and production row counts unchanged.

## Release checklist
- [ ] `npm run check` green (includes the static config guard).
- [ ] Before production migrations: `npm run db:bookmark:prod` and record the bookmark in docs/39, then `npm run db:migrate:prod`.
- [ ] Production deploys use `--branch main`; previews use any other branch.
- [ ] After deploy: production `/api/v1/health` → 200; `https://preview.avorlune.pages.dev/api/v1/health` → 503 `DATABASE_UNAVAILABLE` (until a preview DB exists).
- [ ] Record commit, deployment id and results in docs/39.

## Evidence (2026-11-01)
- Cloudflare Pages API: production config binds `DB → 52632cba…` with `APP_ENV=production`; preview config has **no D1, no R2, no secrets**.
- `https://preview.avorlune.pages.dev` (deployment `586bac1d`, commit `d37b09b`): `GET /api/v1/health` → 503 `DATABASE_UNAVAILABLE`; `POST /inquiries` → 503; `POST /admin/auth/login` → 503. Production project count before/after these calls: 0 → 0.
- Automated: 4 env-guard tests and 4 static config tests pass.
