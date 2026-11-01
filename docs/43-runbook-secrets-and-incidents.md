# 43 — Runbook: Secret Rotation, Access Recovery & Incident Response (B5)

**Status:** Procedures documented. Session revocation on credential rotation is proven by an automated test. A live production rotation has **not** been performed.

## Secrets (Cloudflare Pages, production only)
| Name | Purpose | Effect of rotating |
|---|---|---|
| `ADMIN_EMAIL` | the single admin login | all admin sessions revoked (credential fingerprint changes) |
| `ADMIN_PASSWORD_HASH` | PBKDF2 hash from `scripts/hash-password.mjs` | all admin sessions revoked |
| `LINK_SIGNING_SECRET` | HMAC key for customer links | **every customer link becomes invalid**; reissue per project |

`APP_ENV=production` is a plain var in `wrangler.jsonc`. No secret is in Git, logs, or the browser bundle.

## Rotating the admin password
```bash
node scripts/hash-password.mjs '<new passphrase, at least 12 chars>' | npx wrangler pages secret put ADMIN_PASSWORD_HASH --project-name avorlune
npm run deploy   # secrets are bound at deploy time
```
Sign in with the new passphrase. Old sessions stop working automatically.

## Lost admin access
Whoever holds the Cloudflare account sets a new `ADMIN_PASSWORD_HASH` as above. There is deliberately no email-based reset.

## Suspected customer-link leak
1. Admin → project → **Cabut & buat baru**. This bumps `access_token_version`, killing every earlier link for that project.
2. If many projects or the secret itself may be exposed: rotate `LINK_SIGNING_SECRET`, redeploy, reissue links.
3. If a file was exposed and delivery is enabled: **Tarik** (revoke) the asset.

## Suspected admin session theft
Admin → **Keluar semua** (`POST /admin/auth/logout-all`), then rotate `ADMIN_PASSWORD_HASH`.

## Incident procedure
1. **Contain:** revoke links, sessions or assets as above. If needed, suspend the site: roll back the Pages deployment, or temporarily remove the production DB binding (the API then fails closed with 503).
2. **Preserve evidence:** export `project_events` and the project JSON export, plus Cloudflare logs. Never edit audit rows.
3. **Assess:** affected projects, data categories, time window.
4. **Notify:** decide with qualified counsel whether customers or authorities must be notified under Indonesian law (UU PDP). Do not delay a required notification.
5. **Remediate and record:** fix, rotate, and write the timeline in docs/39.

## Logging policy
Logs are structured JSON via `server/lib/log.ts`. String fields are redacted: emails, phone numbers, tokens, `#t=` fragments, signed query params, password hashes. Request bodies, headers and query strings are never logged.
