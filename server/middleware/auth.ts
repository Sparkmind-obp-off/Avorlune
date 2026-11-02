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

/**
 * B1 — credential fingerprint. Sessions are bound to the admin credential that created them;
 * rotating ADMIN_EMAIL or ADMIN_PASSWORD_HASH invalidates every existing session.
 */
export async function credentialFingerprint(c: Context<AppBindings>): Promise<string | null> {
  const email = (c.env.ADMIN_EMAIL ?? '').trim().toLowerCase()
  const hash = c.env.ADMIN_PASSWORD_HASH ?? ''
  if (!email || !hash) return null
  return (await sha256Hex(`cred:${email}:${hash}`)).slice(0, 32)
}

export async function createSession(c: Context<AppBindings>, userId: string) {
  const token = b64url(randomBytes(32))
  const csrf = b64url(randomBytes(24))
  const expires = new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString()
  const fp = await credentialFingerprint(c)
  await c.env.DB.batch([
    // Opportunistic cleanup of expired sessions (no cron needed).
    c.env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?1').bind(nowIso()),
    // A fresh password login counts as a recent authentication (step-up window starts now).
    c.env.DB.prepare('INSERT INTO sessions (id_hash, user_id, csrf_token, expires_at, created_at, cred_fp, reauth_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?5)')
      .bind(await sha256Hex(token), userId, csrf, expires, nowIso(), fp),
  ])
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure: isSecure(c), sameSite: 'Strict', path: '/api', maxAge: SESSION_TTL_SEC })
  return { csrfToken: csrf, expiresAt: expires }
}

export async function destroySession(c: Context<AppBindings>) {
  const token = getCookie(c, SESSION_COOKIE)
  if (token && token.length <= 100) await c.env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?1').bind(await sha256Hex(token)).run()
  deleteCookie(c, SESSION_COOKIE, { path: '/api', secure: isSecure(c) })
}

export async function destroyAllSessions(c: Context<AppBindings>, userId: string) {
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(userId).run()
  deleteCookie(c, SESSION_COOKIE, { path: '/api', secure: isSecure(c) })
}

const TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/

export async function loadSession(c: Context<AppBindings>): Promise<SessionUser | undefined> {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token || !TOKEN_RE.test(token)) return undefined
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.role, s.csrf_token, s.expires_at, s.cred_fp, s.reauth_at, s.id_hash FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?1`,
  )
    .bind(await sha256Hex(token))
    .first<{ id: string; email: string; role: string; csrf_token: string; expires_at: string; cred_fp: string | null; reauth_at: string | null; id_hash: string }>()
  if (!row || row.expires_at < nowIso()) return undefined
  // C3 — single-admin mode: only the configured admin account is functional.
  if (row.role !== 'admin') return undefined
  const fp = await credentialFingerprint(c)
  if (!fp || !row.cred_fp || !safeEqual(fp, row.cred_fp)) return undefined
  return { id: row.id, email: row.email, role: 'admin', csrfToken: row.csrf_token, sessionHash: row.id_hash, reauthAt: row.reauth_at }
}

/** Step-up window for sensitive operations (docs/48 §5): password re-confirmed within this many seconds. */
export const REAUTH_WINDOW_SEC = 10 * 60

export function hasRecentAuth(user: SessionUser, now = Date.now()) {
  return !!user.reauthAt && now - Date.parse(user.reauthAt) <= REAUTH_WINDOW_SEC * 1000
}

/** Must run after requireStaff. Sensitive actions require a fresh password confirmation. */
export const requireRecentAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const user = c.get('user')
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu')
  if (!hasRecentAuth(user)) throw new ApiError(403, 'REAUTH_REQUIRED', 'Konfirmasi ulang kata sandi untuk aksi ini')
  await next()
}

export async function markReauthenticated(db: D1Database, user: SessionUser) {
  const at = nowIso()
  await db.prepare('UPDATE sessions SET reauth_at = ?1 WHERE id_hash = ?2').bind(at, user.sessionHash).run()
  return at
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Requires an admin session; enforces CSRF token + same-origin on state-changing requests. */
export const requireStaff: MiddlewareHandler<AppBindings> = async (c, next) => {
  const user = await loadSession(c)
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu')
  if (!SAFE_METHODS.has(c.req.method)) {
    const header = c.req.header('x-csrf-token') ?? ''
    if (!safeEqual(header, user.csrfToken)) throw new ApiError(403, 'CSRF_FAILED', 'Token CSRF tidak valid')
    const origin = c.req.header('origin')
    if (origin && origin !== new URL(c.req.url).origin) throw new ApiError(403, 'ORIGIN_MISMATCH', 'Origin tidak diizinkan')
    const site = c.req.header('sec-fetch-site')
    if (site && site !== 'same-origin' && site !== 'none') throw new ApiError(403, 'ORIGIN_MISMATCH', 'Origin tidak diizinkan')
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
