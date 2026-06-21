/**
 * Pack Registry — shared types (Phase 8)
 */

export interface PackRecord {
  id:           string;
  display_name: string;
  description:  string | null;
  author:       string;
  version:      string;
  icon:         string | null;
  color:        string | null;
  is_official:  boolean;
  is_enabled:   boolean;
  status:       'active' | 'disabled' | 'error';
  dependencies: string[];
  installed_at: string;
  created_at:   string;
  updated_at:   string;
}

export interface PackWithStats extends PackRecord {
  node_count: number;
}

export interface PackSyncResult {
  synced:   string[];   // pack IDs upserted
  skipped:  string[];   // already up to date
  errors:   string[];   // failed
}
