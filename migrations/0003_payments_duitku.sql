-- Duitku POP payment orders (docs/46). Additive only.
CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  provider TEXT NOT NULL DEFAULT 'duitku' CHECK (provider IN ('duitku')),
  provider_env TEXT NOT NULL CHECK (provider_env IN ('production','sandbox')),
  merchant_order_id TEXT NOT NULL UNIQUE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'IDR',
  status TEXT NOT NULL CHECK (status IN ('created','pending','paid','failed','expired','cancelled')),
  provider_reference TEXT,
  payment_url TEXT,
  payment_code TEXT,
  publisher_order_id TEXT,
  failure_code TEXT,
  expires_at TEXT NOT NULL,
  paid_at TEXT,
  last_checked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_project ON payment_orders(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status, expires_at);

-- Minimal, non-sensitive record of every callback received (no names, emails, card data, raw body).
CREATE TABLE IF NOT EXISTS payment_callbacks (
  id TEXT PRIMARY KEY,
  merchant_order_id TEXT,
  signature_valid INTEGER NOT NULL,
  result_code TEXT,
  amount TEXT,
  provider_reference TEXT,
  outcome TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payment_callbacks_order ON payment_callbacks(merchant_order_id, created_at);

-- A gateway reference can settle at most one payment row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_gateway_ref ON payments(provider_reference) WHERE provider_reference IS NOT NULL AND method LIKE 'duitku%';
