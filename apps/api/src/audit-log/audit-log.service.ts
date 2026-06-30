/**
 * AuditLogService — Phase 11
 *
 * Queries the `audit_log` table with optional filters and supports CSV export.
 *
 * Table columns (migration 0010):
 *   id, organization_id, project_id, actor_id, event_type,
 *   entity_type, entity_id, summary, metadata, created_at
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

export interface AuditLogFilter {
  organizationId: string;
  actorId?:       string;
  eventType?:     string;
  entityType?:    string;
  projectId?:     string;
  from?:          string;   // ISO timestamp
  to?:            string;   // ISO timestamp
  limit?:         number;
  offset?:        number;
}

export interface AuditLogEntry {
  id:              string;
  organization_id: string | null;
  project_id:      string | null;
  actor_id:        string | null;
  event_type:      string;
  entity_type:     string | null;
  entity_id:       string | null;
  summary:         string;
  metadata:        Record<string, unknown> | null;
  created_at:      string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ── List (paginated) ──────────────────────────────────────────────────────

  async list(filter: AuditLogFilter): Promise<{ data: AuditLogEntry[]; total: number }> {
    const {
      organizationId,
      actorId,
      eventType,
      entityType,
      projectId,
      from,
      to,
      limit  = 50,
      offset = 0,
    } = filter;

    let query = this.supabase.admin
      .from('audit_log')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (actorId)    query = query.eq('actor_id',    actorId);
    if (eventType)  query = query.eq('event_type',  eventType);
    if (entityType) query = query.eq('entity_type', entityType);
    if (projectId)  query = query.eq('project_id',  projectId);
    if (from)       query = query.gte('created_at', from);
    if (to)         query = query.lte('created_at', to);

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`AuditLogService.list: ${error.message}`);
      throw new Error(`Failed to query audit log: ${error.message}`);
    }

    return {
      data:  (data ?? []) as AuditLogEntry[],
      total: count ?? 0,
    };
  }

  // ── CSV export ────────────────────────────────────────────────────────────

  async exportCsv(filter: AuditLogFilter): Promise<string> {
    // For exports, fetch up to 10 000 rows (no pagination)
    const exportFilter: AuditLogFilter = { ...filter, limit: 10_000, offset: 0 };
    const { data } = await this.list(exportFilter);

    const HEADERS = [
      'id', 'created_at', 'event_type', 'entity_type', 'entity_id',
      'actor_id', 'project_id', 'summary', 'metadata',
    ];

    const escape = (v: unknown): string => {
      const s = v === null || v === undefined ? '' : String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = data.map((row) => [
      escape(row.id),
      escape(row.created_at),
      escape(row.event_type),
      escape(row.entity_type),
      escape(row.entity_id),
      escape(row.actor_id),
      escape(row.project_id),
      escape(row.summary),
      escape(row.metadata ? JSON.stringify(row.metadata) : ''),
    ].join(','));

    return [HEADERS.join(','), ...rows].join('\n');
  }
}
