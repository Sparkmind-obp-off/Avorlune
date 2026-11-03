/** Minimal R2-compatible surface used by the asset store (lets tests use an in-memory fake). */
export interface ObjectStore {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>
  get(key: string): Promise<{ body: ReadableStream; size: number; httpMetadata?: { contentType?: string } } | null>
  head(key: string): Promise<{ size: number } | null>
  delete(key: string): Promise<void>
}

export interface Env {
  DB?: D1Database
  /** Private R2 bucket. Absent = private delivery disabled (owner approval pending, ADR-008). */
  DELIVERY_BUCKET?: ObjectStore
  APP_ENV?: string
  LINK_SIGNING_SECRET?: string
  ADMIN_EMAIL?: string
  ADMIN_PASSWORD_HASH?: string
  /** Duitku POP (docs/46). Secrets: merchant code + API key. Vars: env + explicit checkout switch. */
  DUITKU_ENV?: string
  DUITKU_MERCHANT_CODE?: string
  DUITKU_API_KEY?: string
  DUITKU_CHECKOUT_ENABLED?: string
  /** Transactional email (docs/54 §3). Sending happens only when ALL three are set and the switch is 'true'. */
  NOTIFY_EMAIL_ENABLED?: string
  NOTIFY_FROM_EMAIL?: string
  RESEND_API_KEY?: string
  /** Clerk customer auth (docs/79). Publishable key + authorized parties are vars; secret key is a secret. Customers only. */
  CLERK_PUBLISHABLE_KEY?: string
  CLERK_AUTHORIZED_PARTIES?: string
  CLERK_SECRET_KEY?: string
  /** 'true' = final brief submission requires a verified customer account (set only where Clerk is configured). */
  CUSTOMER_AUTH_REQUIRED_FOR_BRIEF?: string
}

export interface CustomerRow {
  id: string
  clerk_user_id: string
  email: string | null
  display_name: string | null
  tags: string
  onboarding_completed_at: string | null
  onboarding_skipped_at: string | null
  last_seen_at: string | null
  created_at: string
}

export interface SessionUser {
  id: string
  email: string
  role: 'admin'
  csrfToken: string
  sessionHash: string
  reauthAt: string | null
}

export type AppBindings = {
  Bindings: Env & { DB: D1Database }
  Variables: { requestId: string; user?: SessionUser; customer?: CustomerRow }
}
