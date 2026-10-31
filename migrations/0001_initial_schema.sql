-- AVORLUNE initial schema (docs/06-data-model.md). Timestamps: UTC ISO-8601 text.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer','producer','admin')),
  auth_subject TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  public_reference TEXT NOT NULL UNIQUE,
  customer_user_id TEXT REFERENCES users(id),
  customer_name TEXT NOT NULL,
  contact_method TEXT NOT NULL CHECK (contact_method IN ('email','whatsapp')),
  customer_contact TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('image','video','mixed')),
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  brief_json TEXT NOT NULL,
  intended_use TEXT NOT NULL,
  requested_deadline TEXT,
  status TEXT NOT NULL CHECK (status IN ('inquiry','qualifying','quoted','awaiting_payment','queued','producing','internal_review','customer_review','revision','approved','delivered','cancelled')),
  access_token_version INTEGER NOT NULL DEFAULT 1,
  revision_rounds_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status, created_at);
CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  currency TEXT NOT NULL DEFAULT 'IDR',
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  scope_json TEXT NOT NULL,
  included_revision_rounds INTEGER NOT NULL DEFAULT 0,
  estimated_delivery_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  accepted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quotes_project ON quotes(project_id, created_at);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'IDR',
  method TEXT NOT NULL,
  provider_reference TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','manually_confirmed','paid','failed','refunded')),
  confirmed_by TEXT REFERENCES users(id),
  confirmed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_project ON payments(project_id);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  uploaded_by TEXT REFERENCES users(id),
  storage_key TEXT NOT NULL UNIQUE,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('customer_reference','preview','final','source')),
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  checksum TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility = 'private'),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  asset_id TEXT REFERENCES assets(id),
  submitted_by TEXT REFERENCES users(id),
  submitted_via TEXT NOT NULL CHECK (submitted_via IN ('customer_link','admin')),
  message TEXT NOT NULL,
  revision_round INTEGER NOT NULL,
  within_scope INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('open','acknowledged','resolved')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_project ON feedback(project_id, created_at);

CREATE TABLE IF NOT EXISTS project_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  actor_user_id TEXT REFERENCES users(id),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system','customer','admin')),
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  safe_metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_project ON project_events(project_id, created_at);

-- Operational tables
CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key_hash TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  project_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
