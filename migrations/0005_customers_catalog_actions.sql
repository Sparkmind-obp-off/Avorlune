-- 0005 — customer accounts (Clerk), unified catalog/offers, action runs, CRM notes (docs/77, docs/78).
-- Additive only: new tables, new nullable columns, idempotent seed rows. No existing row is modified.

-- ---------- Customer accounts (Clerk subject → internal customer id) ----------
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  auth_provider TEXT NOT NULL DEFAULT 'clerk' CHECK (auth_provider IN ('clerk')),
  clerk_user_id TEXT NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT,
  tags TEXT NOT NULL DEFAULT '',
  onboarding_completed_at TEXT,
  onboarding_skipped_at TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

CREATE TABLE IF NOT EXISTS customer_drafts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  kind TEXT NOT NULL CHECK (kind IN ('brief')),
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (customer_id, kind)
);

CREATE TABLE IF NOT EXISTS customer_notes (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  note TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customer_notes ON customer_notes(customer_id, created_at);

-- ---------- Unified catalog ----------
CREATE TABLE IF NOT EXISTS catalog_categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  lane TEXT NOT NULL CHECK (lane IN ('creative_production','creative_products','action_services')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS catalog_items (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  item_type TEXT NOT NULL CHECK (item_type IN ('creative_service','digital_product','action_service','bundle','custom_project')),
  category_id TEXT NOT NULL REFERENCES catalog_categories(id),
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','published','archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_catalog_items_status ON catalog_items(status, item_type, sort_order);

CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  catalog_item_id TEXT NOT NULL REFERENCES catalog_items(id),
  current_version_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','unavailable','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Immutable once created (enforced in application code + tests). Changes = new version.
CREATE TABLE IF NOT EXISTS offer_versions (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES offers(id),
  version INTEGER NOT NULL,
  price_mode TEXT NOT NULL CHECK (price_mode IN ('fixed','starting_at','quote_required','free_demo','internal_only')),
  price_minor INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR'),
  payment_policy TEXT NOT NULL DEFAULT 'deposit_50_balance_50' CHECK (payment_policy IN ('deposit_50_balance_50','none')),
  deliverables_json TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  inputs_json TEXT NOT NULL,
  revision_rounds INTEGER,
  delivery_assumption TEXT NOT NULL,
  rights_summary TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  UNIQUE (offer_id, version),
  CHECK ((price_mode IN ('fixed','starting_at') AND price_minor IS NOT NULL) OR (price_mode NOT IN ('fixed','starting_at') AND price_minor IS NULL))
);

-- Links (nullable; legacy rows untouched).
ALTER TABLE projects ADD COLUMN customer_id TEXT REFERENCES customers(id);
ALTER TABLE projects ADD COLUMN offer_version_id TEXT REFERENCES offer_versions(id);
CREATE INDEX IF NOT EXISTS idx_projects_customer ON projects(customer_id, created_at);

-- ---------- Action runs (human-operated orchestration) ----------
CREATE TABLE IF NOT EXISTS action_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  allowed_operations TEXT NOT NULL,
  inputs_ref TEXT,
  external_side_effect INTEGER NOT NULL DEFAULT 0 CHECK (external_side_effect IN (0,1)),
  requires_customer_authorization INTEGER NOT NULL DEFAULT 1 CHECK (requires_customer_authorization IN (0,1)),
  status TEXT NOT NULL CHECK (status IN ('draft','awaiting_authorization','queued','manual_in_progress','review','completed','failed','cancelled')),
  authorized_at TEXT,
  authorized_by_customer_id TEXT REFERENCES customers(id),
  authorization_scope TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  result_summary TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_action_runs_project ON action_runs(project_id, created_at);

CREATE TABLE IF NOT EXISTS action_run_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES action_runs(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system','customer','admin')),
  actor_id TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('public','internal')),
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_action_steps_run ON action_run_steps(run_id, created_at);

-- ---------- Seed (idempotent; truthful: every offer is quote_required, no prices invented) ----------
INSERT OR IGNORE INTO catalog_categories (id, slug, name, lane, sort_order) VALUES
  ('cat-creative-production', 'ai-creative-production', 'AI Creative Production', 'creative_production', 1),
  ('cat-action-services', 'ai-action-services', 'AI Action Services', 'action_services', 2),
  ('cat-creative-products', 'ai-creative-products', 'AI Creative Products', 'creative_products', 3);

INSERT OR IGNORE INTO catalog_items (id, slug, item_type, category_id, name, tagline, summary, status, sort_order, created_at, updated_at) VALUES
  ('item-ai-image', 'ai-image-production', 'creative_service', 'cat-creative-production', 'AI Image Production',
   'Visual produk dan kampanye yang diarahkan, bukan sekadar digenerate.',
   'Konsep visual produk, key visual kampanye dan set gambar media sosial yang dikerjakan dengan alat AI, diarahkan secara kreatif dan diperiksa manusia sebelum dikirim.',
   'published', 1, '2026-11-03T00:00:00.000Z', '2026-11-03T00:00:00.000Z'),
  ('item-ai-video', 'ai-video-production', 'creative_service', 'cat-creative-production', 'AI Video Production',
   'Video pendek bernarasi, dirakit dengan presisi editorial.',
   'Video promosi pendek, klip visual produk dan konsep kampanye berbasis cerita. Kemampuan teknis bergantung pada alat yang tersedia dan disepakati dalam lingkup.',
   'published', 2, '2026-11-03T00:00:00.000Z', '2026-11-03T00:00:00.000Z'),
  ('item-repurpose', 'content-repurposing-pack', 'action_service', 'cat-action-services', 'Repurpose Konten ke Set Aset Kanal',
   'Satu materi yang sudah Anda setujui, diubah menjadi set aset siap pakai per kanal.',
   'AVORLUNE mengerjakan adaptasi materi sumber milik Anda menjadi set aset dengan format dan rasio per kanal. Kami menyiapkan dan menyerahkan file untuk Anda tinjau; kami tidak memposting atau mengakses akun Anda.',
   'published', 3, '2026-11-03T00:00:00.000Z', '2026-11-03T00:00:00.000Z'),
  ('item-custom', 'custom-project', 'custom_project', 'cat-creative-production', 'Proyek Kustom',
   'Kebutuhan di luar paket? Kita susun lingkupnya bersama.',
   'Untuk kebutuhan kreatif yang tidak cocok dengan layanan lain. Lingkup, deliverable dan harga disusun dalam penawaran tertulis.',
   'published', 4, '2026-11-03T00:00:00.000Z', '2026-11-03T00:00:00.000Z');

INSERT OR IGNORE INTO offers (id, catalog_item_id, current_version_id, status, created_at, updated_at) VALUES
  ('offer-ai-image', 'item-ai-image', 'ov-ai-image-1', 'active', '2026-11-03T00:00:00.000Z', '2026-11-03T00:00:00.000Z'),
  ('offer-ai-video', 'item-ai-video', 'ov-ai-video-1', 'active', '2026-11-03T00:00:00.000Z', '2026-11-03T00:00:00.000Z'),
  ('offer-repurpose', 'item-repurpose', 'ov-repurpose-1', 'active', '2026-11-03T00:00:00.000Z', '2026-11-03T00:00:00.000Z'),
  ('offer-custom', 'item-custom', 'ov-custom-1', 'active', '2026-11-03T00:00:00.000Z', '2026-11-03T00:00:00.000Z');

INSERT OR IGNORE INTO offer_versions (id, offer_id, version, price_mode, price_minor, payment_policy, deliverables_json, scope_json, inputs_json, revision_rounds, delivery_assumption, rights_summary, created_at) VALUES
  ('ov-ai-image-1', 'offer-ai-image', 1, 'quote_required', NULL, 'deposit_50_balance_50',
   '["Konsep visual produk & lifestyle","Key visual kampanye","Set gambar media sosial"]',
   '["Jumlah gambar","Format & rasio aspek","Jumlah putaran revisi","Estimasi waktu pengerjaan","Ketentuan penggunaan"]',
   '["Tujuan & audiens","Foto/aset produk (bila ada)","Referensi visual","Kanal publikasi"]',
   NULL, 'Ditetapkan dalam penawaran setelah brief ditinjau.',
   'Lisensi penggunaan sesuai penawaran; tidak ada janji hak cipta eksklusif atas bagian hasil AI (lihat /ai-licensing).', '2026-11-03T00:00:00.000Z'),
  ('ov-ai-video-1', 'offer-ai-video', 1, 'quote_required', NULL, 'deposit_50_balance_50',
   '["Video promosi pendek","Klip visual produk","Konsep kampanye berbasis cerita"]',
   '["Durasi & jumlah video","Format & rasio aspek","Audio/musik dan lisensinya","Jumlah putaran revisi","Estimasi waktu pengerjaan"]',
   '["Tujuan & audiens","Aset produk/brand","Referensi gaya","Kanal publikasi"]',
   NULL, 'Ditetapkan dalam penawaran setelah brief ditinjau.',
   'Lisensi penggunaan sesuai penawaran; tidak ada janji hak cipta eksklusif atas bagian hasil AI (lihat /ai-licensing).', '2026-11-03T00:00:00.000Z'),
  ('ov-repurpose-1', 'offer-repurpose', 1, 'quote_required', NULL, 'deposit_50_balance_50',
   '["Set aset per kanal sesuai daftar format yang disepakati"]',
   '["Materi sumber yang diadaptasi","Daftar kanal & format","Jumlah variasi","Putaran revisi","Batas: tanpa posting/akses akun klien"]',
   '["Materi sumber milik Anda yang sudah disetujui","Daftar kanal tujuan","Pedoman brand (bila ada)"]',
   NULL, 'Ditetapkan dalam penawaran setelah materi sumber diperiksa.',
   'Hak atas materi sumber tetap milik Anda; lisensi hasil adaptasi sesuai penawaran.', '2026-11-03T00:00:00.000Z'),
  ('ov-custom-1', 'offer-custom', 1, 'quote_required', NULL, 'deposit_50_balance_50',
   '["Ditentukan dalam penawaran"]', '["Disusun bersama berdasarkan brief"]', '["Brief lengkap"]',
   NULL, 'Ditetapkan dalam penawaran.', 'Sesuai penawaran (lihat /ai-licensing).', '2026-11-03T00:00:00.000Z');

-- ---------- Admin audit for actions that are not tied to one project (catalog, CRM) ----------
CREATE TABLE IF NOT EXISTS admin_audit (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit(target_type, target_id, created_at);

-- ---------- 50% deposit + 50% balance payment schedule (docs/59) ----------
-- One accepted quote → milestones. Legacy projects paid before this migration get a single 'full' milestone lazily.
CREATE TABLE IF NOT EXISTS payment_milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  kind TEXT NOT NULL CHECK (kind IN ('deposit','balance','full')),
  sequence INTEGER NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  status TEXT NOT NULL CHECK (status IN ('unpaid','paid','cancelled')),
  payment_id TEXT REFERENCES payments(id),
  paid_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (quote_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON payment_milestones(project_id, sequence);
ALTER TABLE payment_orders ADD COLUMN milestone_id TEXT REFERENCES payment_milestones(id);
ALTER TABLE payments ADD COLUMN milestone_id TEXT REFERENCES payment_milestones(id);
