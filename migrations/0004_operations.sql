-- 0004 — business operations (docs/54). Additive only: new tables, one new nullable column, one seed row.

-- Step-up authentication: time of the last password confirmation for this admin session (docs/48 §5).
ALTER TABLE sessions ADD COLUMN reauth_at TEXT;

-- Auditable manual refund workflow. Money is moved outside the app (Duitku merchant portal / bank);
-- the app records request, decision, evidence and actor. Project status is not rewritten.
CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  payment_id TEXT NOT NULL REFERENCES payments(id),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('requested','processed','rejected')),
  channel TEXT NOT NULL CHECK (channel IN ('duitku_portal','bank_transfer','other')),
  provider_reference TEXT,
  resolution_note TEXT,
  requested_by TEXT REFERENCES users(id),
  resolved_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_refunds_project ON refunds(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id, status);

-- Transactional notification outbox. Recipient is resolved from the project at send time (no contact copy here).
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  event TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email','whatsapp')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','sent','failed','manual_sent','cancelled')),
  provider TEXT,
  provider_message_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TEXT,
  dedupe_key TEXT NOT NULL UNIQUE,
  sent_at TEXT,
  sent_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_notifications_project ON notifications(project_id, created_at);

-- Creative/production provider registry. Nothing is assumed: capabilities start as 'unverified'.
CREATE TABLE IF NOT EXISTS providers (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('ai_generation','stock','tool','other')),
  terms_url TEXT,
  terms_checked_at TEXT,
  commercial_use TEXT NOT NULL CHECK (commercial_use IN ('unverified','allowed','restricted','not_allowed')),
  api_available TEXT NOT NULL CHECK (api_available IN ('unverified','yes','no')),
  notes TEXT,
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO providers (slug, name, kind, terms_url, terms_checked_at, commercial_use, api_available, notes, updated_by, updated_at)
VALUES ('genspark', 'Genspark.ai', 'ai_generation', 'https://www.genspark.ai/terms', '2026-11-02T00:00:00.000Z', 'restricted', 'no',
        'Help Center (read 2026-11-02): commercial use of AI-generated content incl. client work is included only in Plus/Pro/Team/Enterprise plans, for content created during an active subscription, guaranteed through 2027-06-30. Republished content must acknowledge its source. Genspark does not grant third-party model/OSS rights. Automated/programmatic extraction and powering third-party services are prohibited, so production stays human-operated. ToS (2026-04-02): commercial use incl. for third parties allowed subject to plan; account must not be shared/transferred/sold; outputs republished must acknowledge source; user bears third-party IP risk and indemnifies. Reselling credits/access is NOT allowed. Owner plan tier not yet recorded.', NULL, '2026-11-02T00:00:00.000Z');

-- Asset licensing / provenance registry (docs/54 §4).
CREATE TABLE IF NOT EXISTS asset_licenses (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  asset_id TEXT REFERENCES assets(id),
  source_type TEXT NOT NULL CHECK (source_type IN ('customer_provided','ai_generated','licensed_stock','avorlune_original','third_party')),
  provider_slug TEXT REFERENCES providers(slug),
  provider_reference TEXT,
  generation_notes TEXT,
  source_material TEXT,
  license_name TEXT,
  license_evidence TEXT,
  commercial_use TEXT NOT NULL CHECK (commercial_use IN ('unverified','allowed','restricted','not_allowed')),
  restrictions TEXT,
  delivery_permitted INTEGER NOT NULL DEFAULT 0 CHECK (delivery_permitted IN (0,1)),
  qa_approved_by TEXT REFERENCES users(id),
  qa_approved_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_licenses_project ON asset_licenses(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_licenses_asset ON asset_licenses(asset_id);

-- Customer support / issue reporting (customer portal → admin).
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  category TEXT NOT NULL CHECK (category IN ('question','issue','refund_request','other')),
  message TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','resolved')),
  resolution_note TEXT,
  resolved_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_support_project ON support_tickets(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_status ON support_tickets(status, created_at);
