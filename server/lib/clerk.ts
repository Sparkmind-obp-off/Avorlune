import type { Env } from '../env'

/**
 * Clerk customer-session verification (docs/79, Clerk "Manual JWT verification").
 * Customers only — never used for admin. Verifies, per request:
 *   RS256 signature against the instance JWKS (kid match), iss == instance Frontend API,
 *   azp ∈ CLERK_AUTHORIZED_PARTIES (required), exp/nbf with small skew, sub format, sts != pending.
 * Fails closed: no publishable key or no authorized parties => customer auth disabled.
 */
export interface ClerkConfig {
  publishableKey: string
  instance: 'development' | 'production'
  issuer: string
  jwksUrl: string
  authorizedParties: string[]
  secretKey: string | null
}

export function frontendApiFromPublishableKey(pk: string): string | null {
  const m = /^pk_(test|live)_([A-Za-z0-9+/=_-]+)$/.exec(pk)
  if (!m) return null
  try {
    const decoded = atob(m[2].replace(/-/g, '+').replace(/_/g, '/'))
    const host = decoded.replace(/\$$/, '')
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) ? host : null
  } catch {
    return null
  }
}

export function getClerkConfig(env: Env): ClerkConfig | null {
  const pk = (env.CLERK_PUBLISHABLE_KEY ?? '').trim()
  const host = frontendApiFromPublishableKey(pk)
  if (!host) return null
  const authorizedParties = (env.CLERK_AUTHORIZED_PARTIES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\/[^/\s]+$/.test(s))
  if (authorizedParties.length === 0) return null
  // Development Clerk keys must never authenticate production traffic (docs/79 §5).
  if (env.APP_ENV === 'production' && !pk.startsWith('pk_live_')) return null
  const sk = (env.CLERK_SECRET_KEY ?? '').trim()
  return {
    publishableKey: pk,
    instance: pk.startsWith('pk_live_') ? 'production' : 'development',
    issuer: `https://${host}`,
    jwksUrl: `https://${host}/.well-known/jwks.json`,
    authorizedParties,
    secretKey: /^sk_(test|live)_[A-Za-z0-9]+$/.test(sk) ? sk : null,
  }
}

interface Jwk { kid: string; kty: string; n: string; e: string; alg?: string; use?: string }
const jwksCache = new Map<string, { keys: Jwk[]; fetchedAt: number }>()
const JWKS_TTL_MS = 10 * 60_000
const JWKS_MIN_REFRESH_MS = 60_000

/** Test hook only. */
export function resetJwksCache() { jwksCache.clear() }

async function loadJwks(url: string, force = false): Promise<Jwk[]> {
  const cached = jwksCache.get(url)
  const age = cached ? Date.now() - cached.fetchedAt : Infinity
  if (cached && (age < JWKS_TTL_MS && !force)) return cached.keys
  if (cached && force && age < JWKS_MIN_REFRESH_MS) return cached.keys
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error('JWKS_UNAVAILABLE')
  const j = (await res.json()) as { keys?: Jwk[] }
  const keys = (j.keys ?? []).filter((k) => k.kty === 'RSA' && typeof k.kid === 'string')
  jwksCache.set(url, { keys, fetchedAt: Date.now() })
  return keys
}

const b64urlToBytes = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
  return Uint8Array.from(b, (ch) => ch.charCodeAt(0))
}
const b64urlJson = (s: string) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)))

export interface ClerkClaims { sub: string; sid: string | null; azp: string; exp: number }
export type VerifyResult = { ok: true; claims: ClerkClaims } | { ok: false; reason: string }

const SKEW_SEC = 5

export async function verifyClerkToken(cfg: ClerkConfig, token: string, nowSec = Math.floor(Date.now() / 1000)): Promise<VerifyResult> {
  const parts = token.split('.')
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return { ok: false, reason: 'MALFORMED' }
  let header: { alg?: string; kid?: string }
  let payload: Record<string, unknown>
  try { header = b64urlJson(parts[0]); payload = b64urlJson(parts[1]) } catch { return { ok: false, reason: 'MALFORMED' } }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return { ok: false, reason: 'BAD_ALG' }

  let keys: Jwk[]
  try {
    keys = await loadJwks(cfg.jwksUrl)
    if (!keys.some((k) => k.kid === header.kid)) keys = await loadJwks(cfg.jwksUrl, true)
  } catch { return { ok: false, reason: 'JWKS_UNAVAILABLE' } }
  const jwk = keys.find((k) => k.kid === header.kid)
  if (!jwk) return { ok: false, reason: 'UNKNOWN_KID' }

  try {
    const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))
    if (!valid) return { ok: false, reason: 'BAD_SIGNATURE' }
  } catch { return { ok: false, reason: 'BAD_SIGNATURE' } }

  if (payload.iss !== cfg.issuer) return { ok: false, reason: 'BAD_ISSUER' }
  if (typeof payload.exp !== 'number' || payload.exp < nowSec - SKEW_SEC) return { ok: false, reason: 'EXPIRED' }
  if (typeof payload.nbf === 'number' && payload.nbf > nowSec + SKEW_SEC) return { ok: false, reason: 'NOT_YET_VALID' }
  if (typeof payload.azp !== 'string' || !cfg.authorizedParties.includes(payload.azp)) return { ok: false, reason: 'BAD_AZP' }
  if (typeof payload.sub !== 'string' || !/^user_[A-Za-z0-9]{6,64}$/.test(payload.sub)) return { ok: false, reason: 'BAD_SUBJECT' }
  if (payload.sts === 'pending') return { ok: false, reason: 'PENDING' }
  return { ok: true, claims: { sub: payload.sub, sid: typeof payload.sid === 'string' ? payload.sid : null, azp: payload.azp, exp: payload.exp } }
}

/** Server-only: primary verified email + name from the Clerk Backend API. Best-effort; never throws. */
export async function fetchClerkUserProfile(cfg: ClerkConfig, userId: string): Promise<{ email: string | null; name: string | null }> {
  if (!cfg.secretKey) return { email: null, name: null }
  try {
    const res = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, { headers: { authorization: `Bearer ${cfg.secretKey}`, accept: 'application/json' } })
    if (!res.ok) return { email: null, name: null }
    const u = (await res.json()) as {
      primary_email_address_id?: string; first_name?: string | null; last_name?: string | null
      email_addresses?: { id: string; email_address: string; verification?: { status?: string } }[]
    }
    const primary = (u.email_addresses ?? []).find((e) => e.id === u.primary_email_address_id)
    const email = primary && primary.verification?.status === 'verified' ? primary.email_address.toLowerCase().slice(0, 160) : null
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ').slice(0, 120) || null
    return { email, name }
  } catch {
    return { email: null, name: null }
  }
}
