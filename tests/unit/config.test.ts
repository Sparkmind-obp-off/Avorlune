import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/** Strip // and /* *\/ comments from JSONC (strings here contain no comment markers). */
function readJsonc(path: string) {
  const text = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1')
  return JSON.parse(text)
}

const PROD_DB_ID = '52632cba-6b60-44e9-ae3b-3bc82fdbeb43'

describe('A1 — deployment configuration isolation (static guard)', () => {
  const cfg = readJsonc('wrangler.jsonc')

  it('production env binds the production D1 and declares APP_ENV=production', () => {
    expect(cfg.env.production.vars.APP_ENV).toBe('production')
    expect(cfg.env.production.d1_databases.map((d: { database_id: string }) => d.database_id)).toContain(PROD_DB_ID)
  })
  it('preview env declares APP_ENV=preview and can never reach the production database', () => {
    const preview = cfg.env.preview
    expect(preview).toBeDefined()
    expect(preview.vars.APP_ENV).toBe('preview')
    const ids = (preview.d1_databases ?? []).map((d: { database_id: string }) => d.database_id)
    expect(ids).not.toContain(PROD_DB_ID)
    for (const d of preview.d1_databases ?? []) expect(String(d.database_name)).not.toMatch(/production/)
  })
  it('preview has no private asset bucket binding', () => {
    expect(cfg.env.preview.r2_buckets ?? []).toEqual([])
  })
  it('no secrets are committed in wrangler config', () => {
    const raw = readFileSync('wrangler.jsonc', 'utf8')
    expect(raw).not.toMatch(/ADMIN_PASSWORD_HASH|LINK_SIGNING_SECRET|pbkdf2\$/)
  })
})
