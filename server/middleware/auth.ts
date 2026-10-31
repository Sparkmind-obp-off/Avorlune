import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { AppBindings, SessionUser } from '../env'
import { ApiError, newId, nowIso } from '../lib/http'
import { b64url, randomBytes, safeEqual, sha256Hex } from '../lib/crypto'

export const SESSION_COOKIE = 'avl_session'
const SESSION_TTL_SEC = 8 * 3600

function isSecure(c: Context<AppBindings>) {
  return new URL(c.req.url).protocol === 'https:'
}

export async function createSession(c: Context<AppBindings>, userId: string) {
  const token = b64url(randomBytes(32))
  const csrf = b64url(randomBytes(24))
  const expires = new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString()
  await c.env.DB.prepare('INSERT INTO sessions (id_hash, user_id, csrf_token, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(await sha256Hex(token), userId, csrf, expires, nowIso())
    .run()
  // Opportunistic cleanup of expired sessions (no cron needed).
  await c.env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?1').bind(nowIso()).run()
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecure(c),
    sameSite: 'Strict',
    path: '/api',
    maxAge: SESSION_TTL_SEC,
  })
  return { csrfToken: csrf, expiresAt: expires }
}

export async function destroySession(c: Context<AppBindings>) {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?1').bind(await sha256Hex(token)).run()
  deleteCookie(c, SESSION_COOKIE, { path: '/api', secure: isSecure(c) })
}

export async function loadSession(c: Context<AppBindings>): Promise<SessionUser | undefined> {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token || token.length > 100) return undefined
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.role, s.csrf_token, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?1`,
  )
    .bind(await sha256Hex(token))
    .first<{ id: string; email: string; role: string; csrf_token: string; expires_at: string }>()
  if (!row || row.expires_at < nowIso()) return undefined
  if (row.role !== 'admin' && row.role !== 'producer') return undefined
  return { id: row.id, email: row.email, role: row.role, csrfToken: row.csrf_token }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Requires admin/producer session; enforces CSRF token + same-origin on state-changing requests. */
export const requireStaff: MiddlewareHandler<AppBindings> = async (c, next) => {
  const user = await loadSession(c)
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu')
  if (!SAFE_METHODS.has(c.req.method)) {
    const header = c.req.header('x-csrf-token') ?? ''
    if (!safeEqual(header, user.csrfToken)) throw new ApiError(403, 'CSRF_FAILED', 'Token CSRF tidak valid')
    const origin = c.req.header('origin')
    if (origin && origin !== new URL(c.req.url).origin) throw new ApiError(403, 'ORIGIN_MISMATCH', 'Origin tidak diizinkan')
  }
  c.set('user', user)
  await next()
}

/** Bootstrap/refresh the single configured admin account from secrets. */
export async function upsertConfiguredAdmin(db: D1Database, email: string): Promise<string> {
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?1').bind(email).first<{ id: string }>()
  if (existing) {
    await db.prepare("UPDATE users SET role = 'admin', updated_at = ?2 WHERE id = ?1").bind(existing.id, nowIso()).run()
    return existing.id
  }
  const id = newId()
  const now = nowIso()
  await db.prepare("INSERT INTO users (id, email, display_name, role, created_at, updated_at) VALUES (?1, ?2, ?3, 'admin', ?4, ?4)")
    .bind(id, email, 'Admin', now)
    .run()
  return id
}
