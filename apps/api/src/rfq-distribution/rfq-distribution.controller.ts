/**
 * RfqDistributionController
 *
 * GET    /api/v1/organizations/:orgId/rfq-distributions       — list
 * POST   /api/v1/organizations/:orgId/rfq-distributions       — bulk create
 * PATCH  /api/v1/organizations/:orgId/rfq-distributions/:id   — update status
 *
 * Sprint 17 (S17-004)
 */
import {
  Controller, Get, Post, Patch,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import type { ApiResponse } from '@lados/shared-types';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RfqDistributionService } from './rfq-distribution.service';
import {
  CreateRfqDistributionsDto,
  UpdateRfqDistributionDto,
} from './dto/create-rfq-distribution.dto';

@Controller('organizations/:orgId/rfq-distributions')
@UseGuards(SupabaseJwtGuard)
export class RfqDistributionController {
  constructor(private readonly svc: RfqDistributionService) {}

  @Get()
  async findAll(
    @Param('orgId') orgId: string,
    @Query('run_id') run_id?: string,
    @Query('trade') trade?: string,
    @Query('project_id') project_id?: string,
    @CurrentUser() user?: User,
  ): Promise<ApiResponse<unknown[]>> {
    const data = await this.svc.findAll(orgId, user!.id, { run_id, trade, project_id });
    return { success: true, data, error: null };
  }

  @Post()
  async bulkCreate(
    @Param('orgId') orgId: string,
    @Body() dto: CreateRfqDistributionsDto,
    @CurrentUser() user?: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.svc.bulkCreate(orgId, dto, user!.id);
    return { success: true, data, error: null };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRfqDistributionDto,
    @CurrentUser() user?: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.svc.update(id, dto, user!.id);
    return { success: true, data, error: null };
  }
}
