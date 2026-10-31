# Research Data Dictionary & Database Design

Status: PROPOSED — additive module; no production migration has been applied.

## Principles
Store evidence and provenance, not copied media libraries. Keep research data separate from customer projects. Minimize personal data. Preserve retrieval time and source URL. Make every insight traceable.

## Tables

### research_runs
id (text PK), platform, actor_name (nullable), actor_run_id (nullable), query_label, objective, status (planned/approved/running/completed/failed/cancelled), approved_max_usd (numeric default 0), actual_cost_usd (nullable), started_at, completed_at, created_at, notes.

### research_sources
id (text PK), run_id (FK), platform, source_url, creator_label (nullable), published_at (nullable), retrieved_at, content_type, caption_excerpt (nullable; short factual excerpt only), transcript_excerpt (nullable; short excerpt only where permitted), metrics_json (nullable JSON with observation time), language_code, industry_tag, format_tag, hook_tag, visual_style_tag, cta_tag, evidence_grade (A/B/C/D), rights_status (unknown/link_only/licensed/original_notes), raw_payload_ref (nullable; avoid full raw payload by default).

### research_insights
id (text PK), title, claim, interpretation, confidence (low/medium/high), evidence_count, created_at, status (hypothesis/testing/supported/rejected).

### insight_sources
insight_id (FK), source_id (FK), rationale. Composite primary key recommended.

### creative_experiments
id (text PK), insight_id (nullable FK), hypothesis, asset_brief, platform, success_metric, result_summary (nullable), status (draft/ready/running/completed).

## Indexes
research_sources(run_id); research_sources(platform, retrieved_at); research_sources(industry_tag, format_tag); research_insights(status, confidence); insight_sources(insight_id); insight_sources(source_id).

## Retention
Default raw payload retention: none unless necessary and permitted. Keep minimal structured notes and links. Review records after 90 days; delete or anonymize records no longer needed, subject to legal holds. Never put customer briefs, credentials or private assets into research datasets.

## D1 migration gate
Inspect current schema and conventions, create migration, test locally, add access controls, backup/rollback plan, run tests, then deploy. This document does not authorize production schema changes.
