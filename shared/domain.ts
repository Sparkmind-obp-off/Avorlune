import { z } from 'zod'

/** Project lifecycle statuses — see docs/06-data-model.md */
export const PROJECT_STATUSES = [
  'inquiry', 'qualifying', 'quoted', 'awaiting_payment', 'queued', 'producing',
  'internal_review', 'customer_review', 'revision', 'approved', 'delivered', 'cancelled',
] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  inquiry: 'Permintaan masuk',
  qualifying: 'Kualifikasi',
  quoted: 'Penawaran dikirim',
  awaiting_payment: 'Menunggu pembayaran',
  queued: 'Antrean produksi',
  producing: 'Produksi',
  internal_review: 'Review internal',
  customer_review: 'Review klien',
  revision: 'Revisi',
  approved: 'Disetujui',
  delivered: 'Terkirim',
  cancelled: 'Dibatalkan',
}

/** Allowed transitions — docs/07-api-contract.md "Status transition policy". */
export const TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
  inquiry: ['qualifying', 'cancelled'],
  qualifying: ['quoted', 'cancelled'],
  quoted: ['awaiting_payment', 'queued', 'cancelled'],
  awaiting_payment: ['queued', 'cancelled'],
  queued: ['producing', 'cancelled'],
  producing: ['internal_review', 'cancelled'],
  internal_review: ['customer_review', 'producing', 'cancelled'],
  customer_review: ['revision', 'approved', 'cancelled'],
  revision: ['producing', 'cancelled'],
  approved: ['delivered'],
  delivered: [],
  cancelled: [],
}

export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** Admin transitions into these statuses must carry a written reason (audit trail). */
export const REASON_REQUIRED_TARGETS: readonly ProjectStatus[] = ['cancelled', 'approved']

export const SERVICE_TYPES = ['image', 'video', 'mixed'] as const
export type ServiceType = (typeof SERVICE_TYPES)[number]
export const SERVICE_LABELS: Record<ServiceType, string> = {
  image: 'AI Image Production',
  video: 'AI Video Production',
  mixed: 'Gabungan Image + Video',
}

export const DEADLINE_PREFERENCES = ['flexible', 'within_2_weeks', 'within_1_week', 'specific_date'] as const
export const DEADLINE_LABELS: Record<(typeof DEADLINE_PREFERENCES)[number], string> = {
  flexible: 'Fleksibel',
  within_2_weeks: 'Dalam 2 minggu',
  within_1_week: 'Dalam 1 minggu',
  specific_date: 'Tanggal tertentu',
}

export const BUDGET_RANGES = ['undisclosed', 'under_2m', '2m_5m', '5m_15m', 'over_15m'] as const
export const BUDGET_LABELS: Record<(typeof BUDGET_RANGES)[number], string> = {
  undisclosed: 'Belum ditentukan',
  under_2m: '< Rp2 juta',
  '2m_5m': 'Rp2–5 juta',
  '5m_15m': 'Rp5–15 juta',
  over_15m: '> Rp15 juta',
}

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max)
const httpUrl = z
  .string()
  .trim()
  .max(500)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), 'URL harus http(s)')

export const inquirySchema = z
  .object({
    name: trimmed(2, 120),
    contactMethod: z.enum(['email', 'whatsapp']),
    contactValue: trimmed(5, 160),
    serviceType: z.enum(SERVICE_TYPES),
    title: trimmed(3, 140),
    objective: trimmed(10, 1000),
    description: trimmed(20, 4000),
    intendedUse: trimmed(3, 300),
    desiredFormat: trimmed(2, 300),
    deadlinePreference: z.enum(DEADLINE_PREFERENCES),
    deadlineDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    brandUrl: httpUrl.optional().or(z.literal('').transform(() => undefined)),
    referenceLinks: z.array(httpUrl).max(5).default([]),
    budgetRange: z.enum(BUDGET_RANGES).default('undisclosed'),
    consent: z.literal(true, { error: 'Persetujuan wajib dicentang' }),
    rightsConfirmed: z.literal(true, { error: 'Konfirmasi hak materi wajib dicentang' }),
    // Anti-spam: honeypot must stay empty; formStartedAt is the client timestamp (ms) when the form was rendered.
    website: z.string().max(0).optional().default(''),
    formStartedAt: z.number().int().positive().optional(),
    /** Optional catalog offer the brief starts from (resolved server-side to the current offer version). */
    offerSlug: z.string().regex(/^[a-z0-9-]{2,60}$/).optional().or(z.literal('').transform(() => undefined)),
  })
  .superRefine((v, ctx) => {
    if (v.contactMethod === 'email' && !z.string().email().safeParse(v.contactValue).success) {
      ctx.addIssue({ code: 'custom', path: ['contactValue'], message: 'Email tidak valid' })
    }
    if (v.contactMethod === 'whatsapp' && !/^\+?[0-9][0-9\s-]{7,18}$/.test(v.contactValue)) {
      ctx.addIssue({ code: 'custom', path: ['contactValue'], message: 'Nomor WhatsApp tidak valid' })
    }
    if (v.deadlinePreference === 'specific_date' && !v.deadlineDate) {
      ctx.addIssue({ code: 'custom', path: ['deadlineDate'], message: 'Tanggal wajib diisi' })
    }
  })
export type InquiryInput = z.input<typeof inquirySchema>
export type Inquiry = z.output<typeof inquirySchema>

export const statusChangeSchema = z.object({
  toStatus: z.enum(PROJECT_STATUSES),
  reason: z.string().trim().max(500).optional(),
  /** Required when moving to "approved": the specific final asset approved. */
  assetId: z.string().uuid().optional(),
})

export const COST_KINDS = ['labor', 'tool', 'stock_license', 'payment_fee', 'refund', 'other'] as const
export const COST_LABELS: Record<(typeof COST_KINDS)[number], string> = {
  labor: 'Waktu kerja', tool: 'Alat/AI kredit', stock_license: 'Lisensi stok/musik', payment_fee: 'Biaya pembayaran', refund: 'Refund', other: 'Lainnya',
}
export const costSchema = z.object({
  kind: z.enum(COST_KINDS),
  amountMinor: z.number().int().min(0).max(10_000_000_000).default(0),
  minutes: z.number().int().min(0).max(100_000).default(0),
  note: z.string().trim().max(300).optional(),
}).refine((v) => v.amountMinor > 0 || v.minutes > 0, { message: 'Isi jumlah biaya atau menit' })

export const quoteSchema = z.object({
  amountMinor: z.number().int().min(0).max(10_000_000_000),
  currency: z.literal('IDR').default('IDR'),
  deliverables: z.array(trimmed(2, 200)).min(1).max(30),
  includedRevisionRounds: z.number().int().min(0).max(10),
  estimatedDeliveryAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().max(2000).optional(),
  status: z.enum(['draft', 'sent']).default('draft'),
})

export const quoteDecisionSchema = z.object({ decision: z.enum(['accepted', 'rejected']) })

export const paymentConfirmSchema = z.object({
  amountMinor: z.number().int().min(1).max(10_000_000_000),
  method: trimmed(2, 60),
  providerReference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
})

export const noteSchema = z.object({ note: trimmed(1, 2000) })

export const feedbackSchema = z.object({ message: trimmed(5, 4000) })

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(1).max(200),
})

/** Format integer minor units (IDR has 0 decimals in practice) */
export function formatIDR(amountMinor: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amountMinor)
}

/** Unambiguous alphabet (no 0/O/1/I/L) for human-readable references. */
export const REFERENCE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const REFERENCE_PATTERN = /^AVL-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/

export function generateReference(random: (n: number) => Uint8Array): string {
  const bytes = random(8)
  let out = ''
  for (let i = 0; i < 8; i++) out += REFERENCE_ALPHABET[bytes[i] % REFERENCE_ALPHABET.length]
  return `AVL-${out.slice(0, 4)}-${out.slice(4)}`
}
