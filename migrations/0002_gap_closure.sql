-- Gap closure (docs/37, docs/38). Additive only: no drops, no data rewrites.

-- A1: environment identity marker. Each database is stamped once with its environment name;
-- the API refuses to use a database whose marker differs from APP_ENV (fail closed).
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- A2/A3: private asset lifecycle.
ALTER TABLE assets ADD COLUMN original_filename TEXT;
ALTER TABLE assets ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked'));
ALTER TABLE assets ADD COLUMN revoked_at TEXT;
ALTER TABLE assets ADD COLUMN revoked_by TEXT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id, asset_kind, status);

-- A2: the exact final asset the customer approved.
ALTER TABLE projects ADD COLUMN approved_asset_id TEXT REFERENCES assets(id);

-- B1: credential fingerprint per session (rotating the admin credential revokes sessions).
ALTER TABLE sessions ADD COLUMN cred_fp TEXT;
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- D4: lightweight per-project cost/time ledger (actuals only).
CREATE TABLE IF NOT EXISTS project_costs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  kind TEXT NOT NULL CHECK (kind IN ('labor','tool','stock_license','payment_fee','refund','other')),
  amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),
  minutes INTEGER NOT NULL DEFAULT 0 CHECK (minutes >= 0),
  note TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_costs_project ON project_costs(project_id, created_at);
