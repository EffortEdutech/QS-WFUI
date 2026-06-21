/**
 * ArtifactController
 *
 * GET  /projects/:projectId/artifacts          — list all artifacts in a project
 * GET  /projects/:projectId/artifacts/:key     — read single artifact by key
 * POST /projects/:projectId/artifacts          — upsert artifact (write)
 *
 * Also exposes:
 * GET  /artifacts?projectId=...               — flat list (used by canvas node pickers)
 *
 * Phase 9 Correction — upgraded to lados_artifacts table.
 */
import {
  Controller, Get, Post, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { SupabaseJwtGuard }                    from '../common/guards/supabase-jwt.guard';
import { ArtifactService, UpsertArtifactParams } from './artifact.service';

interface UpsertArtifactDto {
  key:            string;
  type?:          'json' | 'text' | 'file';
  data?:          Record<string, unknown>;
  fileUrl?:       string;
  organisationId: string;
  workflowId?:    string;
  runId?:         string;
}

@UseGuards(SupabaseJwtGuard)
@Controller()
export class ArtifactController {
  constructor(private readonly artifacts: ArtifactService) {}

  // ── Project-scoped routes ─────────────────────────────────────────────────

  @Get('projects/:projectId/artifacts')
  async list(@Param('projectId') projectId: string) {
    const data = await this.artifacts.listArtifacts(projectId);
    return { success: true, data, error: null };
  }

  @Get('projects/:projectId/artifacts/:key')
  async get(
    @Param('projectId') projectId: string,
    @Param('key')       key:       string,
  ) {
    const data = await this.artifacts.readArtifact(projectId, key, true);
    return { success: true, data, error: null };
  }

  @Post('projects/:projectId/artifacts')
  async upsert(
    @Param('projectId') projectId: string,
    @Body()             dto:       UpsertArtifactDto,
  ) {
    const data = await this.artifacts.upsertArtifact({
      organisationId: dto.organisationId,
      projectId,
      key:        dto.key,
      type:       dto.type,
      data:       dto.data,
      fileUrl:    dto.fileUrl,
      workflowId: dto.workflowId,
      runId:      dto.runId,
    });
    return { success: true, data, error: null };
  }

  // ── Flat route (canvas node picker) ──────────────────────────────────────

  @Get('artifacts')
  async listFlat(@Query('projectId') projectId: string) {
    if (!projectId) return { success: true, data: [], error: null };
    const data = await this.artifacts.listArtifacts(projectId);
    return { success: true, data, error: null };
  }
}
