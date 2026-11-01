import type { Env, ObjectStore } from '../env'
import { ApiError, newId, nowIso } from '../lib/http'
import { toHex } from '../lib/crypto'

export const MAX_ASSET_BYTES = 25 * 1024 * 1024 // Pages Functions body limit is 100 MB; keep uploads small and bounded.
export const UPLOAD_KINDS = ['preview', 'final'] as const
export type UploadKind = (typeof UPLOAD_KINDS)[number]

/** Statuses in which the customer may see/download previews and finals. */
export const CUSTOMER_VISIBLE_STATUSES = ['customer_review', 'revision', 'approved', 'delivered'] as const
/** Statuses in which staff may upload deliverables. */
export const UPLOAD_STATUSES = ['producing', 'internal_review', 'customer_review', 'revision'] as const

interface Sig { mime: string; ext: string; test: (b: Uint8Array) => boolean }
const at = (b: Uint8Array, off: number, bytes: number[]) => bytes.every((x, i) => b[off + i] === x)
const ascii = (b: Uint8Array, off: number, s: string) => at(b, off, Array.from(s, (ch) => ch.charCodeAt(0)))

/** Allowlist validated by file signature (magic bytes), never by extension or client MIME alone. */
const SIGNATURES: Sig[] = [
  { mime: 'image/png', ext: 'png', test: (b) => at(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => at(b, 0, [0xff, 0xd8, 0xff]) },
  { mime: 'image/webp', ext: 'webp', test: (b) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP') },
  { mime: 'video/mp4', ext: 'mp4', test: (b) => ascii(b, 4, 'ftyp') && !ascii(b, 8, 'qt  ') },
  { mime: 'video/quicktime', ext: 'mov', test: (b) => ascii(b, 4, 'ftyp') && ascii(b, 8, 'qt  ') },
  { mime: 'video/webm', ext: 'webm', test: (b) => at(b, 0, [0x1a, 0x45, 0xdf, 0xa3]) },
  { mime: 'application/pdf', ext: 'pdf', test: (b) => ascii(b, 0, '%PDF-') },
]

export function detectType(bytes: Uint8Array): Sig | null {
  return SIGNATURES.find((s) => s.test(bytes)) ?? null
}

export function safeFilename(name: string | undefined, ext: string): string {
  const base = (name ?? '').normalize('NFKD').replace(/[^A-Za-z0-9._ -]/g, '').replace(/\.+/g, '.').trim().slice(0, 80)
  const stem = base.replace(/\.[A-Za-z0-9]{1,5}$/, '') || 'avorlune-asset'
  return `${stem}.${ext}`
}

/**
 * A3 — returns the private bucket only if a real R2-compatible binding is present.
 * Duck-typed so a misnamed/foreign binding (e.g. the Pages static-asset Fetcher) can never
 * be mistaken for private storage. Absent or invalid => delivery disabled (fail closed).
 */
export function getStore(env: Env): ObjectStore | null {
  const b = env.DELIVERY_BUCKET as unknown as Record<string, unknown> | undefined
  if (!b) return null
  return ['put', 'get', 'head', 'delete'].every((m) => typeof b[m] === 'function') ? (b as unknown as ObjectStore) : null
}

export const deliveryEnabled = (env: Env) => getStore(env) !== null

export function requireStore(env: Env): ObjectStore {
  const s = getStore(env)
  if (!s) throw new ApiError(503, 'DELIVERY_DISABLED', 'Pengiriman file privat belum aktif di lingkungan ini.')
  return s
}

export interface AssetRow {
  id: string
  project_id: string
  storage_key: string
  asset_kind: string
  mime_type: string
  size_bytes: number
  checksum: string | null
  version: number
  status: 'active' | 'revoked'
  original_filename: string | null
  created_at: string
}

export async function storeAsset(env: Env, db: D1Database, projectId: string, kind: UploadKind, body: Uint8Array, filename: string | undefined, uploadedBy: string) {
  const store = requireStore(env)
  if (body.byteLength === 0) throw new ApiError(422, 'EMPTY_FILE', 'File kosong')
  if (body.byteLength > MAX_ASSET_BYTES) throw new ApiError(413, 'FILE_TOO_LARGE', `Ukuran maksimal ${MAX_ASSET_BYTES / 1024 / 1024} MB`)
  const sig = detectType(body.subarray(0, 32))
  if (!sig) throw new ApiError(415, 'FILE_TYPE_NOT_ALLOWED', 'Tipe file tidak diizinkan (PNG, JPEG, WebP, MP4, MOV, WebM, PDF)')
  const id = newId()
  const key = `projects/${projectId}/${crypto.randomUUID()}` // random, non-guessable, never exposed
  const checksum = toHex(await crypto.subtle.digest('SHA-256', body))
  const versionRow = await db.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS v FROM assets WHERE project_id = ?1 AND asset_kind = ?2').bind(projectId, kind).first<{ v: number }>()
  const name = safeFilename(filename, sig.ext)
  await store.put(key, body, { httpMetadata: { contentType: sig.mime }, customMetadata: { projectId, assetId: id } })
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO assets (id, project_id, uploaded_by, storage_key, asset_kind, mime_type, size_bytes, checksum, version, visibility, original_filename, status, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'private', ?10, 'active', ?11)`,
        )
        .bind(id, projectId, uploadedBy, key, kind, sig.mime, body.byteLength, checksum, versionRow?.v ?? 1, name, nowIso()),
    ])
  } catch (e) {
    await store.delete(key) // keep storage and metadata consistent
    throw e
  }
  return { id, kind, mimeType: sig.mime, sizeBytes: body.byteLength, version: versionRow?.v ?? 1, filename: name, checksum }
}

export async function getProjectAsset(db: D1Database, projectId: string, assetId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) return null
  return db.prepare('SELECT * FROM assets WHERE id = ?1 AND project_id = ?2').bind(assetId, projectId).first<AssetRow>()
}

/**
 * A2 — final-deliverable invariant. A final asset is valid only if it: exists, belongs to this
 * project, is kind 'final', is active (not revoked), and its private object is present in storage.
 * Without a configured private store nothing can satisfy it (fail closed).
 */
export async function assertValidFinalAsset(env: Env, db: D1Database, projectId: string, assetId: string | undefined): Promise<AssetRow> {
  const store = getStore(env)
  if (!store) throw new ApiError(409, 'DELIVERY_UNAVAILABLE', 'Persetujuan akhir dinonaktifkan sampai pengiriman file privat aktif.')
  if (!assetId) throw new ApiError(422, 'FINAL_ASSET_REQUIRED', 'Pilih file final yang disetujui')
  const a = await getProjectAsset(db, projectId, assetId)
  if (!a || a.asset_kind !== 'final' || a.status !== 'active') throw new ApiError(409, 'FINAL_ASSET_INVALID', 'File final tidak tersedia untuk disetujui')
  const head = await store.head(a.storage_key)
  if (!head) throw new ApiError(409, 'FINAL_ASSET_MISSING', 'File final tidak tersedia untuk disetujui')
  return a
}

export async function hasValidFinalAsset(env: Env, db: D1Database, projectId: string): Promise<boolean> {
  const store = getStore(env)
  if (!store) return false
  const rows = await db.prepare(`SELECT storage_key FROM assets WHERE project_id = ?1 AND asset_kind = 'final' AND status = 'active'`).bind(projectId).all<{ storage_key: string }>()
  for (const r of rows.results ?? []) if (await store.head(r.storage_key)) return true
  return false
}

export function publicAsset(a: AssetRow) {
  return { id: a.id, kind: a.asset_kind, mimeType: a.mime_type, sizeBytes: a.size_bytes, version: a.version, filename: a.original_filename, status: a.status, createdAt: a.created_at }
}

export async function streamAsset(env: Env, a: AssetRow): Promise<Response> {
  const store = requireStore(env)
  const obj = await store.get(a.storage_key)
  if (!obj) throw new ApiError(404, 'NOT_FOUND', 'File tidak tersedia')
  const name = (a.original_filename ?? 'avorlune-asset').replace(/"/g, '')
  return new Response(obj.body, {
    headers: {
      'content-type': a.mime_type,
      'content-length': String(obj.size),
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      'referrer-policy': 'no-referrer',
    },
  })
}
