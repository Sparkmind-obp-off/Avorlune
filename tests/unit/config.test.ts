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

describe('Duitku configuration (static guard)', () => {
  const cfg = readJsonc('wrangler.jsonc')
  const raw = readFileSync('wrangler.jsonc', 'utf8')
  it('production declares DUITKU_ENV=production with online checkout OFF by default', () => {
    expect(cfg.env.production.vars.DUITKU_ENV).toBe('production')
    expect(cfg.env.production.vars.DUITKU_CHECKOUT_ENABLED).toBe('false')
  })
  it('merchant code and API key are never committed as plain vars', () => {
    for (const vars of [cfg.vars, cfg.env.production.vars, cfg.env.preview.vars]) {
      expect(vars?.DUITKU_API_KEY).toBeUndefined()
      expect(vars?.DUITKU_MERCHANT_CODE).toBeUndefined()
    }
    expect(raw).not.toMatch(/[0-9a-f]{32}/i)
  })
  it('preview has no Duitku configuration at all', () => {
    expect(Object.keys(cfg.env.preview.vars).filter((k) => k.startsWith('DUITKU'))).toEqual([])
  })
  it('CSP script-src is an exact allowlist: self, official Duitku POP hosts, Clerk dev FAPI + Clerk/Cloudflare bot protection', () => {
    const headers = readFileSync('public/_headers', 'utf8')
    const script = headers.match(/script-src ([^;]+);/)?.[1] ?? ''
    expect(script.split(/\s+/).sort()).toEqual([
      "'self'", 'https://app-prod.duitku.com', 'https://app-sandbox.duitku.com',
      'https://exotic-koi-7642.clerk.accounts.dev', 'https://challenges.cloudflare.com', 'https://*.protect.clerk.com',
    ].sort())
    expect(script).not.toMatch(/unsafe-inline|unsafe-eval|\*\s|https:\s|http:/)
  })
})

describe('Clerk configuration (static guard)', () => {
  const raw = readFileSync('wrangler.jsonc', 'utf8')
  const cfg = readJsonc('wrangler.jsonc')
  it('no Clerk secret key is committed anywhere in config', () => {
    expect(raw).not.toMatch(/sk_(test|live)_/)
  })
  it('production never carries a development (pk_test_) publishable key', () => {
    expect(String(cfg.env.production.vars.CLERK_PUBLISHABLE_KEY ?? '')).not.toMatch(/^pk_test_/)
  })
})
