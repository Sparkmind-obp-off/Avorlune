# 42 — Runbook: Backup & Restore (B4)

**Status:** Procedure tested on **local synthetic data**, 2026-11-01. A restore of production data has **not** been performed: production holds no customer data yet, and no isolated remote DB slot is available (see docs/40).

## Recovery mechanisms
1. **D1 Time Travel (point-in-time).** Retention depends on the Cloudflare plan; verify current limits. Before every production migration, record a bookmark with `npm run db:bookmark:prod` and note it in docs/39.
   Restore is **destructive** (overwrites the database) and requires owner approval:
   `npx wrangler d1 time-travel restore avorlune-production --bookmark=<bookmark>`
2. **Logical export (SQL dump)**, kept off-platform by the owner:
   `npx wrangler d1 export avorlune-production --remote --output avorlune-YYYY-MM-DD.sql`
   Store it encrypted in owner-controlled storage. The dump contains customer personal data: never commit it or paste it into chats or issues.

## Restoring into an isolated database (verification)
`wrangler d1 export` writes tables in creation order. Migration 0002 adds `projects.approved_asset_id → assets(id)`, so restoring a raw dump into an **empty** DB fails with `no such table: main.assets`. Reorder the dump first:
```bash
node scripts/reorder-d1-dump.mjs backup.sql backup.ordered.sql
npx wrangler d1 execute avorlune-production --local --persist-to /tmp/restore-check --file backup.ordered.sql
```
Then verify: row counts per table, `PRAGMA quick_check` = ok, `PRAGMA foreign_key_check` = [], `d1_migrations` lists every migration, and `app_meta.environment` is as expected.
**Never** restore a production dump into a preview database.

## Targets (proposed; owner to approve)
- RPO ≤ 24 h (weekly export + Time Travel); RTO ≤ 4 h.
- Export before each migration, and weekly while customers are active.
- Responsible operator: owner/admin.

## Evidence (2026-11-01, local, synthetic data)
- Export: 11,834 bytes. After reordering: 48 statements (13 tables, 23 inserts, 11 indexes/other).
- Restored into isolated `--persist-to /tmp/avl-restore-test/state`: "48 commands executed successfully".
- Source vs restored counts: projects 1/1, quotes 1/1, payments 0/0, project_events 9/9, assets 0/0, app_meta 1/1, users 1/1.
- Content hash (project reference + status): 4343cf64b50f = 4343cf64b50f. quick_check ok; foreign_key_check []; migrations 0001 and 0002 present; marker `development`.
- First raw-dump attempt failed with `no such table: main.assets`; this is why the reorder script exists.
- Production Time Travel bookmark taken before migration 0002: `00000003-00000000-00005116-3d19d411a37353f2ce37243b6f0d0184`.
