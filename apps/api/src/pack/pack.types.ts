/**
 * Pack Registry — shared types (Phase 8 / Phase 14 upgrade)
 */

export interface PackRecord {
  id:               string;
  display_name:     string;
  description:      string | null;
  author:           string;
  version:          string;
  previous_version: string | null;
  icon:             string | null;
  color:            string | null;
  is_official:      boolean;
  is_enabled:       boolean;
  status:           'active' | 'disabled' | 'error';
  dependencies:     string[];
  installed_from:   string;
  checksum:         string | null;
  installed_at:     string;
  created_at:       string;
  updated_at:       string;
}

export interface PackWithStats extends PackRecord {
  node_count:   number;
  health:       PackHealth | null;
}

export interface PackSyncResult {
  synced:   string[];   // pack IDs upserted
  skipped:  string[];   // already up to date
  errors:   string[];   // failed
}

// ── Health ───────────────────────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'degraded' | 'broken';

export interface NodeHealthResult {
  nodeType:    string;
  resolvable:  boolean;
  error?:      string;
}

export interface PackHealth {
  packId:      string;
  status:      HealthStatus;  // healthy = all resolve, degraded = some broken, broken = none resolve
  checkedAt:   string;
  totalNodes:  number;
  brokenNodes: NodeHealthResult[];
}

// ── Node overrides ────────────────────────────────────────────────────────────

export interface PackNodeOverride {
  id:           string;
  org_id:       string;
  pack_id:      string;
  node_type:    string;
  is_enabled:   boolean;
  overridden_by: string | null;
  overridden_at: string;
}
