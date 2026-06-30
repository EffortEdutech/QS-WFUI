/**
 * AssistantController — Phase 2C (V4 AI Runtime)
 *
 * Owner Assistant chat endpoints (distinct from POST /ai/assist which is
 * retained for backward compatibility with existing web UI).
 *
 * POST /assistant/message  — send a message, get AI response, write ledger
 * GET  /assistant/sessions — list conversation sessions for current user
 * GET  /assistant/sessions/:id — full session with all turns
 *
 * All endpoints: auth required (SupabaseJwtGuard), owner|admin role enforced.
 *
 * Phase 2C / LADOS V4 Sprint Plan
 */

import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { ApiResponse }           from '@lados/shared-types';
import { AiService, AssistResponse }  from './ai.service';
import { OutputLedgerService }        from './output-ledger.service';
import { SupabaseJwtGuard }           from '../common/guards/supabase-jwt.guard';
import { SupabaseService }            from '../common/supabase/supabase.service';
import type { AuthenticatedRequest }  from '../common/types/authenticated-request';

// ── DTOs ──────────────────────────────────────────────────────────────────────

class HistoryMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(4000)
  content!: string;
}

class SendMessageDto {
  @IsString()
  orgId!: string;

  @IsString()
  @MaxLength(2000)
  message!: string;

  @IsString()
  sessionId!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HistoryMessageDto)
  history?: HistoryMessageDto[];
}

// ── Convenience wrapper ───────────────────────────────────────────────────────

function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data, error: null };
}

// ── Membership helper ─────────────────────────────────────────────────────────

async function assertOwnerAdmin(
  supabase: SupabaseService,
  orgId:    string,
  actorId:  string,
): Promise<string> {
  const { data: member, error } = await supabase.admin
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', actorId)
    .single();

  if (error || !member) throw new ForbiddenException('Not a member of this organisation');

  const role = member.role as string;
  if (!['owner', 'admin'].includes(role)) {
    throw new ForbiddenException('Owner Assistant is available to owners and admins only');
  }

  return role;
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller('assistant')
@UseGuards(SupabaseJwtGuard)
export class AssistantController {
  constructor(
    private readonly ai:     AiService,
    private readonly ledger: OutputLedgerService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * POST /assistant/message
   *
   * Send one message turn to the Owner Assistant and receive an AI response.
   * Every call writes a ledger row to lados_ai_outputs via OutputLedgerService.
   * Also upserts a session metadata row in ai_assistant_sessions.
   *
   * Body:   { orgId, message, sessionId, history? }
   * Returns { response, sessionId, ledgerId, tokensUsed }
   */
  @Post('message')
  async sendMessage(
    @Body()    dto: SendMessageDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<ApiResponse<AssistResponse>> {
    const actorId = req.user.id;
    const role    = await assertOwnerAdmin(this.supabase, dto.orgId, actorId);

    const result = await this.ai.runAssist({
      orgId:     dto.orgId,
      actorId,
      role,
      message:   dto.message,
      sessionId: dto.sessionId,
      history:   dto.history,
    });

    // Upsert session metadata (non-blocking — don't fail the request if this fails)
    void this.upsertSession(dto.orgId, actorId, dto.sessionId, dto.message, result.tokensUsed);

    return ok(result);
  }

  /**
   * GET /assistant/sessions?orgId=
   *
   * List all conversation sessions for the current user in an org.
   * Sessions are derived from lados_ai_outputs grouped by session_id,
   * augmented with metadata from ai_assistant_sessions when present.
   */
  @Get('sessions')
  async listSessions(
    @Query('orgId') orgId:   string,
    @Request()      req:     AuthenticatedRequest,
  ): Promise<ApiResponse<{
    sessions: Array<{
      sessionId:   string;
      title:       string;
      turnCount:   number;
      totalTokens: number;
      firstTurnAt: string;
      lastTurnAt:  string;
    }>;
  }>> {
    const actorId = req.user.id;
    await assertOwnerAdmin(this.supabase, orgId, actorId);

    // Get session metadata rows
    const { data: metaRows } = await this.supabase.admin
      .from('ai_assistant_sessions')
      .select('session_id, title, turn_count, total_tokens, created_at, updated_at')
      .eq('org_id',   orgId)
      .eq('actor_id', actorId)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (metaRows && metaRows.length > 0) {
      // Use persisted session metadata
      return ok({
        sessions: metaRows.map((row) => ({
          sessionId:   row.session_id as string,
          title:       row.title as string,
          turnCount:   row.turn_count as number,
          totalTokens: row.total_tokens as number,
          firstTurnAt: row.created_at as string,
          lastTurnAt:  row.updated_at as string,
        })),
      });
    }

    // Fallback: derive sessions from ledger rows (for orgs without session metadata yet)
    const sessions = await this.ledger.listSessions(orgId, actorId);
    return ok({
      sessions: sessions.map((s) => ({
        sessionId:   s.sessionId,
        title:       s.firstIntent.slice(0, 60) || 'Conversation',
        turnCount:   s.turnCount,
        totalTokens: 0,
        firstTurnAt: s.firstTurnAt,
        lastTurnAt:  s.lastTurnAt,
      })),
    });
  }

  /**
   * GET /assistant/sessions/:id?orgId=
   *
   * Return a single session with all message turns.
   * Turns come from lados_ai_outputs filtered by session_id.
   */
  @Get('sessions/:id')
  async getSession(
    @Param('id')    sessionId: string,
    @Query('orgId') orgId:     string,
    @Request()      req:       AuthenticatedRequest,
  ): Promise<ApiResponse<{
    sessionId: string;
    title:     string;
    turns:     Array<{
      id:          string;
      intent:      string;
      response:    string;
      tokensUsed:  number;
      model:       string;
      resourceRefs: string[];
      createdAt:   string;
    }>;
  }>> {
    const actorId = req.user.id;
    await assertOwnerAdmin(this.supabase, orgId, actorId);

    // Get session title from metadata if available
    const { data: meta } = await this.supabase.admin
      .from('ai_assistant_sessions')
      .select('title')
      .eq('session_id', sessionId)
      .eq('org_id',     orgId)
      .maybeSingle();

    const title = (meta?.title as string | null) ?? 'Conversation';

    const turns = await this.ledger.getSessionTurns(orgId, sessionId);

    return ok({
      sessionId,
      title,
      turns: turns.map((t) => ({
        id:           t.id,
        intent:       t.intent,
        response:     t.response,
        tokensUsed:   t.tokens_used,
        model:        t.model,
        resourceRefs: t.resource_refs,
        createdAt:    t.created_at,
      })),
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async upsertSession(
    orgId:       string,
    actorId:     string,
    sessionId:   string,
    firstMessage: string,
    tokensAdded: number,
  ): Promise<void> {
    const title = firstMessage.slice(0, 60) || 'Conversation';

    // Try insert first (new session)
    const { error: insertError } = await this.supabase.admin
      .from('ai_assistant_sessions')
      .insert({
        org_id:       orgId,
        actor_id:     actorId,
        session_id:   sessionId,
        title,
        total_tokens: tokensAdded,
        turn_count:   1,
      });

    if (!insertError) return; // New session created

    // Conflict (session already exists) — bump updated_at to surface it in recents
    await this.supabase.admin
      .from('ai_assistant_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('org_id',     orgId);
  }
}
