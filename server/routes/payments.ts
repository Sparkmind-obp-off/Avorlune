import { Hono } from 'hono'
import type { AppBindings } from '../env'
import { getDuitkuConfig } from '../lib/duitku'
import { handleCallback } from '../domain/payments'
import { enforceRateLimit } from '../lib/rateLimit'
import { clientIp } from '../lib/http'

/** Public Duitku webhook. Authenticated by HMAC signature + server-side transactionStatus confirmation. */
export const paymentRoutes = new Hono<AppBindings>()

paymentRoutes.post('/payments/duitku/callback', async (c) => {
  const cfg = getDuitkuConfig(c.env)
  if (!cfg) return c.text('Not Configured', 503)
  await enforceRateLimit(c.env.DB, 'duitku-callback', clientIp(c), 120, 60)
  const len = Number(c.req.header('content-length') ?? '0')
  if (len > 16 * 1024) return c.text('Payload Too Large', 413)
  let fields: Record<string, string> = {}
  try {
    const body = await c.req.parseBody()
    for (const [k, v] of Object.entries(body)) if (typeof v === 'string') fields[k] = v
  } catch {
    fields = {}
  }
  const r = await handleCallback(cfg, c.env.DB, fields)
  return c.text(r.body, r.status)
})
