-- ============================================================
-- Migration 0038 — Node Registry Performance Indexes
--
-- RLS on registered_nodes and packs was already added in 0004.
-- This migration adds partial indexes for the GET /node-registry
-- hot path: fetch all enabled nodes grouped by active pack.
-- ============================================================

-- Partial index: enabled nodes by pack (NodeRegistryService.getRegistry hot path)
CREATE INDEX IF NOT EXISTS idx_registered_nodes_pack_enabled
  ON registered_nodes(pack_id)
  WHERE is_enabled = true;

-- Partial index: enabled nodes by category (GET /nodes?category= filter)
CREATE INDEX IF NOT EXISTS idx_registered_nodes_category_enabled
  ON registered_nodes(category)
  WHERE is_enabled = true;

-- Partial index: active packs (PackInstaller + NodeRegistry listing)
CREATE INDEX IF NOT EXISTS idx_packs_active
  ON packs(is_enabled, status)
  WHERE is_enabled = true AND status = 'active';

COMMENT ON INDEX idx_registered_nodes_pack_enabled IS
  'Supports GET /node-registry pack-grouped query (Phase 1H)';
COMMENT ON INDEX idx_registered_nodes_category_enabled IS
  'Supports GET /nodes?category= filter';
COMMENT ON INDEX idx_packs_active IS
  'Supports PackInstallerService and NodeRegistryService active-pack queries';
