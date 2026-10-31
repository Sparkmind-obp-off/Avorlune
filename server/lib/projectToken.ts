import { hmac, safeEqual, b64url, fromB64url } from './crypto'

/**
 * Customer project access token: high-entropy, HMAC-signed, expiring and revocable
 * (bumping projects.access_token_version invalidates all prior links).
 */
export const PROJECT_TOKEN_TTL_SEC = 30 * 24 * 3600

export async function signProjectToken(secret: string, projectId: string, version: number, ttlSec = PROJECT_TOKEN_TTL_SEC, nowSec = Math.floor(Date.now() / 1000)) {
  const exp = nowSec + ttlSec
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(12)))
  const payload = `${projectId}.${version}.${exp}.${nonce}`
  const sig = await hmac(secret, `project-access:${payload}`)
  return { token: `${b64url(new TextEncoder().encode(payload))}.${sig}`, expiresAt: new Date(exp * 1000).toISOString() }
}

export async function verifyProjectToken(secret: string, token: string, nowSec = Math.floor(Date.now() / 1000)) {
  const [p, sig] = token.split('.')
  if (!p || !sig || token.length > 400) return null
  let payload: string
  try {
    payload = new TextDecoder().decode(fromB64url(p))
  } catch {
    return null
  }
  const expected = await hmac(secret, `project-access:${payload}`)
  if (!safeEqual(expected, sig)) return null
  const [projectId, v, e] = payload.split('.')
  const version = Number(v)
  const exp = Number(e)
  if (!projectId || !Number.isInteger(version) || !Number.isInteger(exp)) return null
  if (exp <= nowSec) return null
  return { projectId, version, exp }
}
