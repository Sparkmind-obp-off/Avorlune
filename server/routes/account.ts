import { Hono } from 'hono'
import { z } from 'zod'
import type { AppBindings } from '../env'
import { STATUS_LABELS } from '../../shared/domain'
import { newId, nowIso, ok, parseJson } from '../lib/http'
import { enforceRateLimit } from '../lib/rateLimit'
import { getClerkConfig } from '../lib/clerk'
import { requireCustomer } from '../middleware/customer'

/** Customer account endpoints (Clerk-verified). Every query is scoped to the verified internal customer id. */
export const accountRoutes = new Hono<AppBindings>()

/** Public runtime config: only the publishable key (browser-safe) and only when customer auth is valid for this environment. */
accountRoutes.get('/config', (c) => {
  const cfg = getClerkConfig(c.env)
  return ok(c, {
    environment: c.env.APP_ENV ?? null,
    clerkPublishableKey: cfg?.publishableKey ?? null,
    clerkInstance: cfg?.instance ?? null,
    briefRequiresAccount: !!cfg && c.env.CUSTOMER_AUTH_REQUIRED_FOR_BRIEF === 'true',
  })
})

const me = new Hono<AppBindings>()
me.use('*', requireCustomer)
me.use('*', async (c, next) => {
  await enforceRateLimit(c.env.DB, 'account', c.get('customer')!.id, 120, 60)
  await next()
})

me.get('/', (c) => {
  const cu = c.get('customer')!
  return ok(c, {
    id: cu.id,
    email: cu.email,
    displayName: cu.display_name,
    onboarding: { completed: !!cu.onboarding_completed_at, skipped: !!cu.onboarding_skipped_at },
    createdAt: cu.created_at,
  })
})

const onboardingSchema = z.object({
  action: z.enum(['skip', 'complete']),
  displayName: z.string().trim().min(2).max(120).optional(),
})
me.post('/onboarding', async (c) => {
  const cu = c.get('customer')!
  const input = await parseJson(c, onboardingSchema)
  const now = nowIso()
  if (input.action === 'skip') {
    await c.env.DB.prepare('UPDATE customers SET onboarding_skipped_at = COALESCE(onboarding_skipped_at, ?1), updated_at = ?1 WHERE id = ?2').bind(now, cu.id).run()
  } else {
    await c.env.DB.prepare('UPDATE customers SET onboarding_completed_at = COALESCE(onboarding_completed_at, ?1), display_name = COALESCE(?2, display_name), updated_at = ?1 WHERE id = ?3')
      .bind(now, input.displayName ?? null, cu.id).run()
  }
  return ok(c, { action: input.action })
})

/** Brief draft: only primitive form fields, bounded. Bound to the verified customer — never to a browser-supplied id. */
const draftValue = z.union([z.string().max(4000), z.boolean(), z.number()])
const draftSchema = z.object({ data: z.record(z.string().regex(/^[A-Za-z]{1,40}$/), draftValue) })
  .refine((v) => Object.keys(v.data).length <= 40, { message: 'Terlalu banyak field' })

me.get('/draft', async (c) => {
  const row = await c.env.DB.prepare(`SELECT data_json, updated_at FROM customer_drafts WHERE customer_id = ?1 AND kind = 'brief'`).bind(c.get('customer')!.id).first<{ data_json: string; updated_at: string }>()
  return ok(c, row ? { data: JSON.parse(row.data_json), updatedAt: row.updated_at } : null)
})

me.put('/draft', async (c) => {
  const cu = c.get('customer')!
  const { data } = await parseJson(c, draftSchema)
  const now = nowIso()
  await c.env.DB.prepare(`INSERT INTO customer_drafts (id, customer_id, kind, data_json, created_at, updated_at) VALUES (?1, ?2, 'brief', ?3, ?4, ?4)
                          ON CONFLICT(customer_id, kind) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`)
    .bind(newId(), cu.id, JSON.stringify(data), now).run()
  return ok(c, { savedAt: now })
})

me.delete('/draft', async (c) => {
  await c.env.DB.prepare(`DELETE FROM customer_drafts WHERE customer_id = ?1 AND kind = 'brief'`).bind(c.get('customer')!.id).run()
  return ok(c, { deleted: true })
})

me.get('/projects', async (c) => {
  const rows = await c.env.DB.prepare(`SELECT p.public_reference, p.title, p.service_type, p.status, p.created_at, p.updated_at, i.name AS offer_name
      FROM projects p LEFT JOIN offer_versions ov ON ov.id = p.offer_version_id LEFT JOIN offers o ON o.id = ov.offer_id LEFT JOIN catalog_items i ON i.id = o.catalog_item_id
      WHERE p.customer_id = ?1 ORDER BY p.created_at DESC LIMIT 100`).bind(c.get('customer')!.id)
    .all<{ public_reference: string; title: string; service_type: string; status: string; created_at: string; updated_at: string; offer_name: string | null }>()
  return ok(c, {
    projects: (rows.results ?? []).map((r) => ({
      reference: r.public_reference, title: r.title, serviceType: r.service_type, status: r.status,
      statusLabel: STATUS_LABELS[r.status as keyof typeof STATUS_LABELS] ?? r.status, offerName: r.offer_name, createdAt: r.created_at, updatedAt: r.updated_at,
    })),
  })
})

accountRoutes.route('/me', me)
