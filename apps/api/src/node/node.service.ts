import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

// ── Select strings ────────────────────────────────────────────────────────────
// V3 select includes uses_services + data_pack_deps (requires migration 0013).
// If those columns don't exist yet (schema cache lag or migration pending),
// we fall back to the pre-0013 select so the app stays functional.

const SELECT_V3 = `
  type, name, description, version, category, icon, color, tags,
  inputs, outputs, config_schema, ui_schema, pack_id,
  uses_services, data_pack_deps,
  packs ( id, display_name, color, icon )
`;

const SELECT_FALLBACK = `
  type, name, description, version, category, icon, color, tags,
  inputs, outputs, config_schema, ui_schema, pack_id,
  packs ( id, display_name, color, icon )
`;

/** Detect Postgres "column does not exist" (42703) or PostgREST 400 errors
 *  that indicate migration 0013 hasn't been applied yet. */
function isMissingColumnError(msg: string): boolean {
  return (
    msg.includes('uses_services') ||
    msg.includes('data_pack_deps') ||
    msg.includes('42703')
  );
}

@Injectable()
export class NodeService {
  constructor(private readonly supabase: SupabaseService) {}

  /** List all enabled nodes, optionally filtered by category or pack */
  async findAll(options?: { category?: string; packId?: string }) {
    const runQuery = async (select: string) => {
      let q = this.supabase.admin
        .from('registered_nodes')
        .select(select)
        .eq('is_enabled', true)
        .order('category')
        .order('name');

      if (options?.category) q = q.eq('category', options.category);
      if (options?.packId)   q = q.eq('pack_id',  options.packId);

      return q;
    };

    // Try V3 select first
    const { data, error } = await runQuery(SELECT_V3);
    if (!error) return data ?? [];

    // If the error is about missing V3 columns, fall back silently
    if (isMissingColumnError(error.message)) {
      const { data: fallback, error: fbErr } = await runQuery(SELECT_FALLBACK);
      if (fbErr) throw new Error(fbErr.message);
      return fallback ?? [];
    }

    throw new Error(error.message);
  }

  /** Get a single node definition by type */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async findOne(type: string): Promise<Record<string, any>> {
    const runQuery = async (select: string) =>
      this.supabase.admin
        .from('registered_nodes')
        .select(select)
        .eq('type', type)
        .eq('is_enabled', true)
        .single();

    // Try V3 select first
    const { data, error } = await runQuery(SELECT_V3);
    if (!error && data) return data;

    // Column missing → fall back
    if (error && isMissingColumnError(error.message)) {
      const { data: fallback, error: fbErr } = await runQuery(SELECT_FALLBACK);
      if (fbErr ?? !fallback) throw new NotFoundException(`Node type "${type}" not found`);
      return fallback;
    }

    if (error ?? !data) throw new NotFoun