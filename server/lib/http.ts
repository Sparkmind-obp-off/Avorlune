import type { Context } from 'hono'
import type { ZodSchema } from 'zod'
import type { AppBindings } from '../env'

export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 411 | 413 | 415 | 422 | 429 | 500 | 503,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message)
  }
}

export function ok<T>(c: Context<AppBindings>, data: T, status: 200 | 201 = 200) {
  return c.json({ data, requestId: c.get('requestId') }, status)
}

const MAX_JSON_BYTES = 32 * 1024

export async function parseJson<T>(c: Context<AppBindings>, schema: ZodSchema<T>): Promise<T> {
  const ct = c.req.header('content-type') ?? ''
  if (!ct.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type harus application/json')
  }
  const len = Number(c.req.header('content-length') ?? '0')
  if (len > MAX_JSON_BYTES) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Payload terlalu besar')
  const text = await c.req.text()
  if (text.length > MAX_JSON_BYTES) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Payload terlalu besar')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Body bukan JSON yang valid')
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_'
      if (!fields[key]) fields[key] = issue.message
    }
    throw new ApiError(422, 'VALIDATION_ERROR', 'Data tidak valid', { fields })
  }
  return parsed.data
}

export const nowIso = () => new Date().toISOString()
export const newId = () => crypto.randomUUID()

/**
 * B1 — only the Cloudflare-set `cf-connecting-ip` header is trusted. Client-supplied
 * X-Forwarded-For / X-Real-IP are ignored so they cannot be used to evade rate limits.
 * (Cloudflare overwrites cf-connecting-ip on every request to a Pages deployment.)
 */
export function clientIp(c: Context<AppBindings>): string {
  return c.req.header('cf-connecting-ip')?.trim() || 'unknown'
}
