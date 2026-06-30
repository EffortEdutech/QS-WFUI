/**
 * OutputLedgerService — Phase 2B (V4 AI Runtime)
 *
 * Extracted from AiService.writeLedger() to satisfy Phase 2B requirement:
 *   "OutputLedgerService.record() called after every AI completion"
 *
 * Every call to AiService.runAssist() / callWithTools() must produce a ledger
 * row in lados_ai_outputs. This service encapsulates that concern so it can
 * be injected independently (useful for nodes that call AI directly).
 *
 * Table: lados_ai_outputs (created in migration 0035_ai_runtime.sql)
 *
 * GUARDRAIL: this service only INSERTs to the ledger. It never writes to
 * resource tables, state machines, approval queues, or finance tables.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LedgerRecord {
  orgId:           string;
  actorId:         string | null;
  sessionId:       string;
  /** First ~120 chars of the user message — stored as intent summary */
  intent:          string;
  /** Snapshot of the AiContext object fed to the model */
  contextSnapshot: Record<string, unknown>;
  /** The final text response returned to the user */
  response:        string;
  /** All tool_calls arrays across all OpenAI rounds */
  toolCalls:       unknown[];
  /** IDs of lados_resources rows surfaced by tool calls */
  resourceRefs:    string[];
  tokensUsed:      number;
  model:           string;
  latencyMs:       number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class OutputLedgerService {
  private readonly logger = new Logger(OutputLedgerService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Append a row to lados_ai_outputs.
   *
   * Returns the new row ID on success, or 'ledger-error' if the write fails
   * (non-throwing — a ledger failure must never break the caller's response).
   */
  async record(params: LedgerRecord): Promise<string> {
    const { data, error } = await this.supabase.admin
      .from('lados_ai_outputs')
      .insert({
        org_id:           params.orgId,
        actor_id:         params.actorId || null,
        session_id:       params.sessionId,
        intent:           params.intent,
        context_snapshot: params.contextSnapshot,
        response:         params.response,
        tool_calls:       params.toolCalls,
        resource_refs:    params.resourceRefs,
        tokens_used:      params.tokensUsed,
        model:            params.model,
        latency_ms:       params.latencyMs,
      })
      .select('id')
      .single();

    if (error) {
      this.logger.warn(`OutputLedger.record: write failed — ${error.message}`);
      return 'ledger-error';
    }

    return (data as { id: string }).id;
  }

  /**
   * Retrieve ledger rows for a session, ordered oldest-first.
   * Used by GET /assistant/sessions/:id.
   */
  async getSessionTurns(
    orgId:     string,
    sessionId: string,
    limit      = 50,
  ): Promise<Array<{
    id:         string;
    intent:     string;
    response:   string;
    tool_calls: unknown[];
    resource_refs: string[];
    tokens_used:   number;
    model:         string;
    latency_ms:    number | null;
    created_at:    string;
  }>> {
    const { data } = await this.supabase.admin
      .from('lados_ai_outputs')
      .select('id, intent, response, tool_calls, resource_refs, tokens_used, model, latency_ms, created_at')
      .eq('org_id',    orgId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);

    return (data ?? []) as Array<{
      id:            string;
      intent:        string;
      response:      string;
      tool_calls:    unknown[];
      resource_refs: string[];
      tokens_used:   number;
      model:         string;
      latency_ms:    number | null;
      created_at:    string;
    }>;
  }

  /**
   * List distinct sessions for a user in an org.
   * Sessions are derived from lados_ai_outputs — no separate sessions table needed.
   * Returns sessions ordered by most recent activity.
   */
  async listSessions(
    orgId:   string,
    actorId: string,
    limit    = 20,
  ): Promise<Array<{
    sessionId:  string;
    turnCount:  number;
    firstIntent: string;
    firstTurnAt: string;
    lastTurnAt:  string;
  }>> {
    // Fetch recent rows for the actor and group client-side
    // (Supabase JS client doesn't support GROUP BY natively — use raw select)
    const { data } = await this.supabase.admin
      .from('lados_ai_outputs')
      .select('session_id, intent, created_at')
      .eq('org_id',   orgId)
      .eq('actor_id', actorId)
      .order('created_at', { ascending: false })
      .limit(500);  // fetch enough to group

    if (!data || data.length === 0) return [];

    // Group by session_id
    const sessionMap = new Map<string, {
      sessionId:   string;
      firstIntent: string;
      firstTurnAt: string;
      lastTurnAt:  string;
      turnCount:   number;
    }>();

    // Process in reverse (oldest first) so firstIntent / firstTurnAt are correct
    const reversed = [...data].reverse();
    for (const row of reversed) {
      const sid = row.session_id as string;
      const existing = sessionMap.get(sid);
      if (!existing) {
        sessionMap.set(sid, {
          sessionId:   sid,
          firstIntent: (row.intent as string) ?? '',
          firstTurnAt: row.created_at as string,
          lastTurnAt:  row.created_at as string,
          turnCount:   1,
        });
      } else {
        existing.turnCount++;
        existing.lastTurnAt = row.created_at as string;
      }
    }

    // Sort by most recent and cap at limit
    return [...sessionMap.values()]
      .sort((a, b) => b.lastTurnAt.localeCompare(a.lastTurnAt))
      .slice(0, limit);
  }
}
