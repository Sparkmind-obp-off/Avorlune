import { ApiError } from './http'
import { sha256Hex } from './crypto'

/**
 * Fixed-window limiter persisted in D1 (no KV/paid services).
 * Identifiers are hashed so raw IPs are never stored.
 */
export async function enforceRateLimit(db: D1Database, scope: string, identifier: string, limit: number, windowSec: number) {
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - (now % windowSec)
  const key = `${scope}:${(await sha256Hex(identifier)).slice(0, 32)}`
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (bucket_key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(bucket_key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
         window_start = excluded.window_start
       RETURNING count`,
    )
    .bind(key, windowStart)
    .first<{ count: number }>()
  if ((row?.count ?? 0) > limit) {
    throw new ApiError(429, 'RATE_LIMITED', 'Terlalu banyak permintaan. Coba lagi nanti.')
  }
}
