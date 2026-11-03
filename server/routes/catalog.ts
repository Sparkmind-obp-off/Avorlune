import { Hono } from 'hono'
import { z } from 'zod'
import type { AppBindings } from '../env'
import { ApiError, newId, nowIso, ok, parseJson } from '../lib/http'

/** Unified catalog (docs/77). Public read is unauthenticated; mutations live under /admin (see adminPlatformRoutes). */
export const catalogRoutes = new Hono<AppBindings>()

interface ItemRow {
  id: string; slug: string; item_type: string; name: string; tagline: string; summary: string; status: string; sort_order: number
  category_slug: string; category_name: string; lane: string; offer_id: string | null; offer_status: string | null
  version_id: string | null; version: number | null; price_mode: string | null; price_minor: number | null; payment_policy: string | null
  deliverables_json: string | null; scope_json: string | null; inputs_json: string | null; revision_rounds: number | null
  delivery_assumption: string | null; rights_summary: string | null
}

const BASE = `SELECT i.id, i.slug, i.item_type, i.name, i.tagline, i.summary, i.status, i.sort_order,
  c.slug AS category_slug, c.name AS category_name, c.lane, o.id AS offer_id, o.status AS offer_status,
  ov.id AS version_id, ov.version, ov.price_mode, ov.price_minor, ov.payment_policy, ov.deliverables_json, ov.scope_json, ov.inputs_json,
  ov.revision_rounds, ov.delivery_assumption, ov.rights_summary
  FROM catalog_items i JOIN catalog_categories c ON c.id = i.category_id
  LEFT JOIN offers o ON o.catalog_item_id = i.id LEFT JOIN offer_versions ov ON ov.id = o.current_version_id`

const parse = (s: string | null) => (s ? (JSON.parse(s) as string[]) : [])

export function publicItem(r: ItemRow, detail = false) {
  const available = r.offer_status === 'active' && !!r.version_id && r.price_mode !== 'internal_only'
  return {
    slug: r.slug, type: r.item_type, name: r.name, tagline: r.tagline, summary: r.summary,
    category: { slug: r.category_slug, name: r.category_name, lane: r.lane },
    available,
    offer: r.version_id ? {
      version: r.version, priceMode: r.price_mode, priceMinor: r.price_minor, currency: 'IDR',
      deliverables: parse(r.deliverables_json),
      ...(detail ? { scope: parse(r.scope_json), inputs: parse(r.inputs_json), revisionRounds: r.revision_rounds, deliveryAssumption: r.delivery_assumption, rightsSummary: r.rights_summary } : {}),
    } : null,
  }
}

catalogRoutes.get('/catalog', async (c) => {
  const type = c.req.query('type')
  const lane = c.req.query('lane')
  const q = (c.req.query('q') ?? '').trim().toLowerCase().slice(0, 60)
  const rows = await c.env.DB.prepare(`${BASE} WHERE i.status = 'published' ORDER BY i.sort_order, i.name`).all<ItemRow>()
  const items = (rows.results ?? [])
    .filter((r) => (!type || r.item_type === type) && (!lane || r.lane === lane))
    .filter((r) => !q || `${r.name} ${r.tagline} ${r.summary}`.toLowerCase().includes(q))
    .map((r) => publicItem(r))
  const cats = await c.env.DB.prepare('SELECT slug, name, lane FROM catalog_categories ORDER BY sort_order').all()
  return ok(c, { items, categories: cats.results ?? [] })
})

catalogRoutes.get('/catalog/:slug', async (c) => {
  const slug = c.req.param('slug')
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) throw new ApiError(404, 'NOT_FOUND', 'Layanan tidak ditemukan')
  const r = await c.env.DB.prepare(`${BASE} WHERE i.slug = ?1 AND i.status = 'published'`).bind(slug).first<ItemRow>()
  if (!r) throw new ApiError(404, 'NOT_FOUND', 'Layanan tidak ditemukan')
  return ok(c, publicItem(r, true))
})

// ---------- Admin catalog (mounted inside the admin router, after requireStaff) ----------
export const adminCatalogRoutes = new Hono<AppBindings>()

adminCatalogRoutes.get('/catalog', async (c) => {
  const rows = await c.env.DB.prepare(`${BASE} ORDER BY i.sort_order, i.name`).all<ItemRow>()
  const counts = await c.env.DB.prepare('SELECT offer_id, COUNT(*) n FROM offer_versions GROUP BY offer_id').all<{ offer_id: string; n: number }>()
  const n = new Map((counts.results ?? []).map((x) => [x.offer_id, x.n]))
  return ok(c, { items: (rows.results ?? []).map((r) => ({ id: r.id, status: r.status, offerId: r.offer_id, offerStatus: r.offer_status, versionCount: r.offer_id ? n.get(r.offer_id) ?? 0 : 0, ...publicItem(r, true) })) })
})

const list = (max: number) => z.array(z.string().trim().min(2).max(300)).min(1).max(max)
const versionSchema = z.object({
  priceMode: z.enum(['fixed', 'starting_at', 'quote_required', 'free_demo', 'internal_only']),
  priceMinor: z.number().int().min(1).max(10_000_000_000).optional(),
  pricingEvidence: z.string().trim().min(10).max(1000).optional(),
  deliverables: list(20), scope: list(20), inputs: list(20),
  revisionRounds: z.number().int().min(0).max(10).optional(),
  deliveryAssumption: z.string().trim().min(5).max(500),
  rightsSummary: z.string().trim().min(10).max(1000),
}).superRefine((v, ctx) => {
  const priced = v.priceMode === 'fixed' || v.priceMode === 'starting_at'
  if (priced && !v.priceMinor) ctx.addIssue({ code: 'custom', path: ['priceMinor'], message: 'Harga wajib untuk mode fixed/starting_at' })
  if (!priced && v.priceMinor !== undefined) ctx.addIssue({ code: 'custom', path: ['priceMinor'], message: 'Harga hanya untuk mode fixed/starting_at' })
  // Fixed/starting_at prices require written unit-economics evidence (docs/62, docs/78 §4).
  if (priced && !v.pricingEvidence) ctx.addIssue({ code: 'custom', path: ['pricingEvidence'], message: 'Catat dasar harga (unit economics) untuk harga tetap' })
})

/** New immutable offer version. Existing versions are never updated; accepted snapshots keep pointing to their version. */
adminCatalogRoutes.post('/catalog/offers/:offerId/versions', async (c) => {
  const offerId = c.req.param('offerId')
  const db = c.env.DB
  const offer = /^[a-z0-9-]{3,60}$/i.test(offerId) ? await db.prepare('SELECT id FROM offers WHERE id = ?1').bind(offerId).first<{ id: string }>() : null
  if (!offer) throw new ApiError(404, 'NOT_FOUND', 'Offer tidak ditemukan')
  const v = await parseJson(c, versionSchema)
  const next = await db.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS v FROM offer_versions WHERE offer_id = ?1').bind(offer.id).first<{ v: number }>()
  const id = newId()
  const now = nowIso()
  const user = c.get('user')!
  await db.batch([
    db.prepare(`INSERT INTO offer_versions (id, offer_id, version, price_mode, price_minor, payment_policy, deliverables_json, scope_json, inputs_json, revision_rounds, delivery_assumption, rights_summary, created_by, created_at)
                VALUES (?1, ?2, ?3, ?4, ?5, 'deposit_50_balance_50', ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`)
      .bind(id, offer.id, next?.v ?? 1, v.priceMode, v.priceMinor ?? null, JSON.stringify(v.deliverables), JSON.stringify(v.scope), JSON.stringify(v.inputs), v.revisionRounds ?? null, v.deliveryAssumption, v.rightsSummary, user.id, now),
    db.prepare('UPDATE offers SET current_version_id = ?1, updated_at = ?2 WHERE id = ?3').bind(id, now, offer.id),
    db.prepare(`INSERT INTO admin_audit (id, actor_user_id, action, target_type, target_id, metadata_json, created_at) VALUES (?1, ?2, 'offer_version_created', 'offer', ?3, ?4, ?5)`)
      .bind(newId(), user.id, offer.id, JSON.stringify({ versionId: id, version: next?.v ?? 1, priceMode: v.priceMode, priceMinor: v.priceMinor ?? null, pricingEvidence: v.pricingEvidence ?? null }), now),
  ])
  return ok(c, { id, version: next?.v ?? 1 }, 201)
})

const statusSchema = z.object({ itemStatus: z.enum(['draft', 'published', 'archived']).optional(), offerStatus: z.enum(['active', 'unavailable', 'retired']).optional() })
  .refine((v) => v.itemStatus || v.offerStatus, { message: 'Tidak ada perubahan' })

adminCatalogRoutes.patch('/catalog/items/:itemId', async (c) => {
  const itemId = c.req.param('itemId')
  const db = c.env.DB
  const item = /^[a-z0-9-]{3,60}$/i.test(itemId) ? await db.prepare('SELECT id FROM catalog_items WHERE id = ?1').bind(itemId).first<{ id: string }>() : null
  if (!item) throw new ApiError(404, 'NOT_FOUND', 'Item tidak ditemukan')
  const input = await parseJson(c, statusSchema)
  const now = nowIso()
  const stmts: D1PreparedStatement[] = []
  if (input.itemStatus) stmts.push(db.prepare('UPDATE catalog_items SET status = ?1, updated_at = ?2 WHERE id = ?3').bind(input.itemStatus, now, item.id))
  if (input.offerStatus) stmts.push(db.prepare('UPDATE offers SET status = ?1, updated_at = ?2 WHERE catalog_item_id = ?3').bind(input.offerStatus, now, item.id))
  stmts.push(db.prepare(`INSERT INTO admin_audit (id, actor_user_id, action, target_type, target_id, metadata_json, created_at) VALUES (?1, ?2, 'catalog_status_changed', 'catalog_item', ?3, ?4, ?5)`)
    .bind(newId(), c.get('user')!.id, item.id, JSON.stringify(input), now))
  await db.batch(stmts)
  return ok(c, { id: item.id })
})
