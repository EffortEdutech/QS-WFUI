-- ============================================================
-- Migration 0004: Packs + Registered Nodes
-- Sprint 5 (S5-003, S5-004)
-- ============================================================

-- ── packs ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS packs (
  id            text PRIMARY KEY,                     -- e.g. "lados.qs-pack"
  display_name  text NOT NULL,
  description   text,
  author        text NOT NULL DEFAULT 'Lados Platform',
  version       text NOT NULL DEFAULT '1.0.0',
  icon          text,
  color         text,
  is_official   boolean NOT NULL DEFAULT false,
  is_enabled    boolean NOT NULL DEFAULT true,
  permissions   jsonb NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_packs_updated_at
  BEFORE UPDATE ON packs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── registered_nodes ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS registered_nodes (
  type          text PRIMARY KEY,                     -- e.g. "qs.read_boq"
  pack_id       text NOT NULL REFERENCES packs(id),
  name          text NOT NULL,
  description   text,
  version       text NOT NULL DEFAULT '1.0.0',
  category      text NOT NULL,                        -- core | qs | procurement | document | ai
  icon          text,
  color         text,
  tags          text[] NOT NULL DEFAULT '{}',
  inputs        jsonb NOT NULL DEFAULT '[]',          -- NodePort[]
  outputs       jsonb NOT NULL DEFAULT '[]',          -- NodePort[]
  config_schema jsonb NOT NULL DEFAULT '[]',          -- ConfigField[]
  ui_schema     jsonb NOT NULL DEFAULT '{}',          -- NodeUISchema
  is_enabled    boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS registered_nodes_pack_id_idx ON registered_nodes(pack_id);
CREATE INDEX IF NOT EXISTS registered_nodes_category_idx ON registered_nodes(category);

CREATE TRIGGER set_registered_nodes_updated_at
  BEFORE UPDATE ON registered_nodes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Packs and nodes are public read (any authenticated user can browse)

ALTER TABLE packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read packs"
  ON packs FOR SELECT TO authenticated USING (true);

ALTER TABLE registered_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read nodes"
  ON registered_nodes FOR SELECT TO authenticated USING (true);

-- ── Seed: Official Packs ─────────────────────────────────────────────────────

INSERT INTO packs (id, display_name, description, author, version, icon, color, is_official) VALUES
  ('lados.core-pack',        'Core',          'Trigger, approval, logger and flow-control nodes', 'Lados Platform', '1.0.0', 'cpu',           '#6B7280', true),
  ('lados.qs-pack',          'QS',            'Quantity Surveying — BOQ, trade classification, work packages', 'Lados Platform', '1.0.0', 'calculator', '#3B82F6', true),
  ('lados.procurement-pack', 'Procurement',   'RFQ generation, vendor management, quotation comparison', 'Lados Platform', '1.0.0', 'shopping-cart', '#10B981', true),
  ('lados.document-pack',    'Document',      'File upload, Excel/PDF reading, document generation', 'Lados Platform', '1.0.0', 'file-text',   '#F59E0B', true),
  ('lados.ai-pack',          'AI',            'Classifier, summariser, OCR, drawing analysis', 'Lados Platform', '1.0.0', 'zap',           '#8B5CF6', true)
ON CONFLICT (id) DO NOTHING;
