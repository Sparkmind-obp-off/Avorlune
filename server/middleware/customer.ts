import type { Context, MiddlewareHandler } from 'hono'
import type { AppBindings, CustomerRow } from '../env'
import { ApiError, newId, nowIso } from '../lib/http'
import { fetchClerkUserProfile, getClerkConfig, verifyClerkToken } from '../lib/clerk'
import { logEvent } from '../lib/log'

const BEARER = /^Bearer ([A-Za-z0-9._-]{20,4096})$/

export const hasBearer = (c: Context<AppBindings>) => /^Bearer /.test(c.req.header('authorization') ?? '')

/**
 * Verify the Clerk session token from `Authorization: Bearer` and map the immutable Clerk subject to an internal customer.
 * Never trusts browser-supplied ids or emails. Email is fetched server-side (verified primary address) and is an attribute only.
 */
export async function authenticateCustomer(c: Context<AppBindings>): Promise<CustomerRow> {
  const cached = c.get('customer')
  if (cached) return cached
  const cfg = getClerkConfig(c.env)
  if (!cfg) throw new ApiError(503, 'CUSTOMER_AUTH_DISABLED', 'Akun pelanggan belum aktif di lingkungan ini')
  const m = BEARER.exec(c.req.header('authorization') ?? '')
  if (!m) throw new ApiError(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu')
  const r = await verifyClerkToken(cfg, m[1])
  if (!r.ok) {
    logEvent('warn', 'customer_token_rejected', { reason: r.reason, requestId: c.get('requestId') })
    if (r.reason === 'JWKS_UNAVAILABLE') throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Layanan masuk sedang tidak tersedia')
    throw new ApiError(401, 'INVALID_SESSION', 'Sesi tidak valid atau kedaluwarsa. Silakan masuk kembali.')
  }
  const db = c.env.DB
  const sub = r.claims.sub
  let row = await db.prepare('SELECT * FROM customers WHERE clerk_user_id = ?1').bind(sub).first<CustomerRow>()
  const now = nowIso()
  if (!row) {
    const profile = await fetchClerkUserProfile(cfg, sub)
    await db.prepare(`INSERT OR IGNORE INTO customers (id, auth_provider, clerk_user_id, email, display_name, tags, last_seen_at, created_at, updated_at)
                      VALUES (?1, 'clerk', ?2, ?3, ?4, '', ?5, ?5, ?5)`).bind(newId(), sub, profile.email, profile.name, now).run()
    row = await db.prepare('SELECT * FROM customers WHERE clerk_user_id = ?1').bind(sub).first<CustomerRow>()
    if (!row) throw new ApiError(500, 'INTERNAL_ERROR', 'Gagal memuat akun')
  } else if (!row.last_seen_at || Date.parse(now) - Date.parse(row.last_seen_at) > 10 * 60_000) {
    await db.prepare('UPDATE customers SET last_seen_at = ?1 WHERE id = ?2').bind(now, row.id).run()
  }
  c.set('customer', row)
  return row
}

export const requireCustomer: MiddlewareHandler<AppBindings> = async (c, next) => {
  await authenticateCustomer(c)
  await next()
}
