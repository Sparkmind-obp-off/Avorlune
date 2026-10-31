# Apify Technical Integration Specification

Status: proposed; no Apify API token or production connector configured.

## Architecture
Admin Research Console → Hono API → Research service → Apify adapter → Actor run → Dataset fetch → normalization → D1 research tables → insight review UI.

Keep this module separate from customer inquiry/project data. Never expose Apify credentials to the browser.

## Adapter contract
discoverActors(query): discovery only. inspectActor(actorId): schema, README, pricing and metadata. estimateRun(input, policy): validate sample and budget. startRun(actorId, input, limits): require approval record. getRun(runId): status and storage metadata. fetchDataset(datasetId, projection, limit): bounded rows. normalize(platform, rawItem): ResearchSource. cancelRun(runId): stop active run where supported.

## Security
- Store token only as encrypted server-side secret if configured.
- Never commit token, bundle it into frontend, or put it in logs/URLs/database.
- Require admin authorization and CSRF for run/cancel actions.
- Audit Actor, input summary, approval ID, spend cap, run ID, operator and timestamps.
- Allowlist Actor IDs; block arbitrary Actor execution from public endpoints.
- Validate inputs against fetched Actor schema.
- Apply timeouts, result limits and rate limits.

## API proposal
POST /api/admin/research/briefs — create draft brief  
GET /api/admin/research/briefs — list briefs  
POST /api/admin/research/briefs/:id/approve — approve scope and spend cap  
POST /api/admin/research/runs — execute approved brief only  
GET /api/admin/research/runs/:id — run status  
POST /api/admin/research/runs/:id/cancel — cancel active run  
GET /api/admin/research/sources — filtered normalized records  
POST /api/admin/research/insights — create reviewed insight

## Environment
APIFY_API_TOKEN is server-side only and absent by default. Do not assume token connected. Existing Cloudflare Pages/Hono/D1 stack is target; inspect current repo/deployment before implementation.

## Deployment gates
No production integration until token availability is confirmed securely, pricing approved, Actor allowlist reviewed, D1 migration tested, admin UI protected, audit trail tested and rollback verified.
