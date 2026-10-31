# Apify Ingestion Workflow

Status: design only. No production integration is active.

## Pipeline
1. Research brief: define question, scope, platform, sample and expected decision.
2. Actor selection: inspect README, schema, pricing, developer and terms.
3. Approval: confirm spend ceiling, permitted public data and sampling limit.
4. Run: submit narrow input with cost caps.
5. Poll: record run ID/status; handle timeout, failure and cancellation.
6. Fetch: retrieve only required fields and bounded rows.
7. Normalize: map fields into the data dictionary; preserve URL and retrieval time.
8. Deduplicate: canonical URL + platform; mark reposts separately.
9. Quality checks: missing URLs, duplicates, language, timestamps, suspicious metrics and relevance.
10. Analyze: code themes, evidence grades and caveats.
11. Human review: approve insight before it informs offers or claims.
12. Archive: record run/cost and retain only permitted minimum data.

## Failure handling
Invalid input: compare with current schema before retry. Rate limit/block: reduce scope and respect restrictions; never bypass access controls. Empty dataset: record no result, not proof of absent demand. Partial run: mark partial. Cost cap reached: stop and require new approval. Duplicate content: preserve canonical reference and relationship.

## Human checkpoints
Before run: scope, source, input, pricing, cap and compliance. After run: sample quality, cost, interpretation, confidence and experiment.

## Prohibited automation
No automated likes, follows, comments, DMs, posting, account creation, login/session extraction or private-data collection. Public research only.
