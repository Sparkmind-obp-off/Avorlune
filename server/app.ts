import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import type { AppBindings } from './env'
import { ApiError } from './lib/http'
import { logEvent } from './lib/log'
import { envGuard } from './middleware/envGuard'
import { publicRoutes } from './routes/public'
import { customerRoutes } from './routes/customer'
import { adminRoutes } from './routes/admin'
import { paymentRoutes } from './routes/payments'
import { accountRoutes } from './routes/account'
import { catalogRoutes } from './routes/catalog'

export function createApp() {
  const app = new Hono<AppBindings>().basePath('/api/v1')

  app.use('*', async (c, next) => {
    c.set('requestId', crypto.randomUUID())
    await next()
    if (!c.res.headers.get('cache-control')) c.header('cache-control', 'no-store')
    c.header('x-request-id', c.get('requestId'))
  })
  app.use('*', secureHeaders({ referrerPolicy: 'no-referrer', crossOriginResourcePolicy: 'same-origin' }))
  app.use('*', envGuard)

  app.route('/', publicRoutes)
  app.route('/', customerRoutes)
  app.route('/', paymentRoutes)
  app.route('/', catalogRoutes)
  app.route('/account', accountRoutes)
  app.route('/admin', adminRoutes)

  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan' }, requestId: c.get('requestId') }, 404))

  app.onError((err, c) => {
    const requestId = c.get('requestId')
    if (err instanceof ApiError) {
      return c.json({ error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) }, requestId }, err.status)
    }
    // Redacted structured log: no body, headers, query string, contact data or tokens.
    logEvent('error', 'unhandled_error', { requestId, path: new URL(c.req.url).pathname, method: c.req.method, name: (err as Error)?.name, message: String((err as Error)?.message ?? '') })
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server' }, requestId }, 500)
  })

  return app
}
