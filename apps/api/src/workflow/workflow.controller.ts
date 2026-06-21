import {
  Controller, Get, Post, Patch, Put, Delete,
  Param, Body, UseGuards, HttpCode,
} from '@nestjs/common';

import type { User } from '@supabase/supabase-js';
import type { ApiResponse } from '@lados/shared-types';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkflowService } from './workflow.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { SaveDefinitionDto } from './dto/save-definition.dto';

/**
 * WorkflowController
 *
 * GET    /api/v1/projects/:projectId/workflows
 * POST   /api/v1/projects/:projectId/workflows
 * GET    /api/v1/projects/:projectId/workflows/:id
 * PATCH  /api/v1/projects/:projectId/workflows/:id
 * PUT    /api/v1/projects/:projectId/workflows/:id/definition  ← canvas auto-save
 */
@Controller('projects/:projectId/workflows')
@UseGuards(SupabaseJwtGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get()
  async findAll(
    @Param('projectId') projectId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<unknown[]>> {
    const data = await this.workflowService.findAllInProject(projectId, user.id);
    return { success: true, data, error: null };
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflowService.findOne(id, user.id);
    return { success: true, data, error: null };
  }

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateWorkflowDto,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflowService.create(projectId, dto, user.id);
    return { success: true, data, error: null };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflowService.update(id, dto, user.id);
    return { success: true, data, error: null };
  }

  /** Canvas auto-save — PUT replaces the full definition */
  @Put(':id/definition')
  async saveDefinition(
    @Param('id') id: string,
    @Body() dto: SaveDefinitionDto,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflowService.saveDefinition(id, dto, user.id);
    return { success: true, data, error: null };
  }

  /** Export workflow as a portable JSON bundle — Sprint 16 (S16-004) */
  @Get(':id/export')
  async exportWorkflow(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflowService.exportWorkflow(id, user.id);
    return { success: true, data, error: null };
  }

  /** Import a workflow JSON bundle into a project — Sprint 16 (S16-004) */
  @Post('import')
  async importWorkflow(
    @Param('projectId') projectId: string,
    @Body() bundle: Record<string, unknown>,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflowService.importWorkflow(projectId, bundle, user.id);
    return { success: true, data, error: null };
  }

  // ── Phase 1: Publish ──────────────────────────────────────────────────────

  /**
   * POST /projects/:projectId/workflows/:id/publish
   *
   * Snapshots current definition → sets published_version_id.
   * Executions will run from this snapshot, not the live draft.
   */
  @Post(':id/publish')
  async publish(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflowService.publish(id, user.id);
    return { success: true, data, error: null };
  }

  // ── S18-002: Versioning endpoints ─────────────────────────────────────────

  /** POST /projects/:projectId/workflows/:id/versions — snapshot current definition */
  @Post(':id/versions')
  async snapshotVersion(
    @Param('id') id: string,
    @Body() body: { label?: string },
    @CurrentUser() user: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflowService.snapshotVersion(id, user.id, body.label);
    return { success: true, data, error: null };
  }

  /** GET /projects/:projectId/workflows/:id/versions — list all versions */
  @Get(':id/versions')
  async listVersions(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<unknown[]>> {
    const data = await this.workflowService.listVersions(id, user.id);
    return { success: true, data, error: null };
  }

  /** POST /projects/:projectId/workflows/:id/versions/:versionId/restore */
  @Post(':id/versions/:versionId/restore')
  async restoreVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflowService.restoreVersion(id, versionId, user.id);
    return { success: true, data, error: null };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.workflowService.delete(id, user.id);
    return { success: true, data, error: null };
  }
}
