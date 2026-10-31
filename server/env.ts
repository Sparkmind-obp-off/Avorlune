export interface Env {
  DB: D1Database
  APP_ENV?: string
  LINK_SIGNING_SECRET?: string
  ADMIN_EMAIL?: string
  ADMIN_PASSWORD_HASH?: string
}

export interface SessionUser {
  id: string
  email: string
  role: 'admin' | 'producer'
  csrfToken: string
}

export type AppBindings = {
  Bindings: Env
  Variables: { requestId: string; user?: SessionUser }
}
