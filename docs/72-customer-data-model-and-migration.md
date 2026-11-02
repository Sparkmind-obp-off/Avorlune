# 72 — Customer Data Model & Migration

**Status:** Logical target model. Inspect live schema before any migration.

## Principles
Preserve production D1 and current records. Additive migrations only. Reuse existing users/projects/inquiries/quotes/payment_orders/assets/support/events. Determine what current users represent before extending it.

## Logical entities
Customer identity mapping (provider + immutable subject → internal customer ID); customer profile; onboarding state; consent records; brief drafts; customer tags; customer notes with visibility; activity references; demo fixtures isolated from production. Existing projects retain their original contact snapshots. Quotes remain immutable by version. Payment schedule remains linked to accepted quote.

## Relationships
One customer has many projects. Each project has inquiry history, quote versions, payment schedule, production events, assets and optional support tickets. Identity provider subject is unique. Email alone never proves ownership.

## Migration sequence
Read migrations and live schema; map current records; identify provable ownership; backfill only verified mappings; leave unclaimed legacy projects on signed-link access; add bounded search indexes; test local migration and rollback; take production backup/bookmark before approved migration.

## Integrity
Foreign keys, unique provider+subject, bounded text, normalized statuses, integer IDR minor units, UTC timestamps, idempotent linking, optimistic concurrency. Deletion workflow retains legally required finance/audit records and anonymizes where appropriate.

## Acceptance
No existing IDs or payment states change; no email-only project claim; demo cannot enter production; migrations additive and tested.