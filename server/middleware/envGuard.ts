import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../env'
import { ApiError } from '../lib/http'
import { logEvent } from '../lib/log'

const ALLOWED_ENVS = new Set(['production', 'preview', 'development', 'test'])
const verified = new WeakMap<object, string>()

/**
 * A1 — environment isolation guard (fail closed).
 * The API only touches a database stamped (app_meta.environment) with the same name as APP_ENV.
 * A preview deployment has no DB binding at all; if someone ever binds the production DB to a
 * non-production deployment, the marker mismatch blocks every read and write.
 */
export const envGuard: MiddlewareHandler<AppBindings> = async (c, next) => {
  const appEnv = c.env.APP_ENV
  if (!appEnv || !ALLOWED_ENVS.has(appEnv)) throw new ApiError(503, 'ENV_NOT_CONFIGURED', 'Lingkungan aplikasi belum dikonfigurasi')
  const db = c.env.DB as D1Database | undefined
  if (!db) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Lingkungan ini tidak terhubung ke database (preview terisolasi).')
  if (verified.get(db) !== appEnv) {
    let marker: string | null = null
    try {
      marker = (await db.prepare(`SELECT value FROM app_meta WHERE key = 'environment'`).first<{ value: string }>())?.value ?? null
    } catch {
      marker = null
    }
    if (marker !== appEnv) {
      logEvent('error', 'env_mismatch', { requestId: c.get('requestId'), appEnv, markerPresent: marker !== null })
      throw new ApiError(503, 'ENV_MISMATCH', 'Konfigurasi database tidak cocok dengan lingkungan. Akses diblokir.')
    }
    verified.set(db, appEnv)
  }
  await next()
}
