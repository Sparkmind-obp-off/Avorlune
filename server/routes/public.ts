import { Hono } from 'hono'
import type { AppBindings } from '../env'
import { inquirySchema, generateReference } from '../../shared/domain'
import { SERVICES, PORTFOLIO } from '../../shared/catalogue'
import { ApiError, clientIp, newId, nowIso, ok, parseJson } from '../lib/http'
import { enforceRateLimit, pruneOperationalData } from '../lib/rateLimit'
import { randomBytes, sha256Hex } from '../lib/crypto'
import { eventStmt } from '../domain/events'
import { notificationStmt } from '../domain/notifications'

export const publicRoutes = new Hono<AppBindings>()

publicRoutes.get('/health', (c) => ok(c, { status: 'ok' }))
publicRoutes.get('/services', (c) => ok(c, SERVICES))
publicRoutes.get('/portfolio', (c) => ok(c, PORTFOLIO))

const MIN_FILL_MS = 3000

publicRoutes.post('/inquiries', async (c) => {
  const db = c.env.DB
  await enforceRateLimit(db, 'inquiry', clientIp(c), 5, 3600)
  const input = await parseJson(c, inquirySchema)

  // Spam controls: honeypot + minimum human fill time. Respond generically to avoid tuning by bots.
  if (input.website || (input.formStartedAt && Date.now() - input.formStartedAt < MIN_FILL_MS)) {
    throw new ApiError(422, 'SUBMISSION_REJECTED', 'Pengiriman tidak dapat diproses. Silakan coba lagi.')
  }

  // Duplicate submission handling via client idempotency key.
  const idemKey = c.req.header('idempotency-key')
  let idemHash: string | null = null
  if (idemKey) {
    if (!/^[A-Za-z0-9-]{16,64}$/.test(idemKey)) throw new ApiError(400, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key tidak valid')
    idemHash = await sha256Hex(`inquiry:${idemKey}`)
    const prior = await db
      .prepare('SELECT p.public_reference FROM idempotency_keys k JOIN projects p ON p.id = k.project_id WHERE k.key_hash = ?1')
      .bind(idemHash)
      .first<{ public_reference: string }>()
    if (prior) return ok(c, { reference: prior.public_reference, duplicate: true })
  }

  const id = newId()
  const now = nowIso()
  const brief = {
    description: input.description,
    desiredFormat: input.desiredFormat,
    deadlinePreference: input.deadlinePreference,
    brandUrl: input.brandUrl ?? null,
    referenceLinks: input.referenceLinks,
    budgetRange: input.budgetRange,
    consentAt: now,
    rightsConfirmedAt: now,
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = generateReference(randomBytes)
    try {
      const stmts = [
        db
          .prepare(
            `INSERT INTO projects (id, public_reference, customer_name, contact_method, customer_contact, service_type, title, objective, brief_json, intended_use, requested_deadline, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'inquiry', ?12, ?12)`,
          )
          .bind(id, reference, input.name, input.contactMethod, input.contactValue, input.serviceType, input.title, input.objective, JSON.stringify(brief), input.intendedUse, input.deadlineDate ?? null, now),
        eventStmt(db, { projectId: id, actorType: 'customer', eventType: 'inquiry_created', toStatus: 'inquiry', metadata: { serviceType: input.serviceType } }),
        notificationStmt(db, { id, public_reference: reference, title: input.title, customer_name: input.name, contact_method: input.contactMethod }, 'project_submitted', 'created'),
      ]
      if (idemHash) {
        stmts.push(db.prepare("INSERT INTO idempotency_keys (key_hash, scope, project_id, created_at) VALUES (?1, 'inquiry', ?2, ?3)").bind(idemHash, id, now))
      }
      await db.batch(stmts)
      await pruneOperationalData(db)
      return ok(c, { reference, duplicate: false }, 201)
    } catch (err) {
      const msg = String((err as Error)?.message ?? err)
      if (idemHash && msg.includes('idempotency_keys')) {
        const prior = await db.prepare('SELECT p.public_reference FROM idempotency_keys k JOIN projects p ON p.id = k.project_id WHERE k.key_hash = ?1').bind(idemHash).first<{ public_reference: string }>()
        if (prior) return ok(c, { reference: prior.public_reference, duplicate: true })
      }
      if (!msg.includes('public_reference')) throw err
      // Reference collision: retry with a new reference.
    }
  }
  throw new ApiError(500, 'REFERENCE_GENERATION_FAILED', 'Gagal membuat referensi proyek')
})
