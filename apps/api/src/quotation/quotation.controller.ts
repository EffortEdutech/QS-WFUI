/**
 * QuotationController
 *
 * GET    /api/v1/projects/:projectId/quotations            — list
 * POST   /api/v1/projects/:projectId/quotations            — create
 * GET    /api/v1/projects/:projectId/quotations/:id        — get one
 * PATCH  /api/v1/projects/:projectId/quotations/:id        — update
 *
 * Sprint 17 (S17-005)
 */
import {
  Controller, Get, Post, Patch,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import type { ApiResponse } from '@lados/shared-types';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { QuotationService } from './quotation.service';
import { CreateQuotationDto, UpdateQuotationDto } from './dto/create-quotation.dto';

@Controller('projects/:projectId/quotations')
@UseGuards(SupabaseJwtGuard)
export class QuotationController {
  constructor(private readonly quotationService: QuotationService) {}

  @Get()
  async findAll(
    @Param('projectId') projectId: string,
    @Query('trade') trade?: string,
    @Query('supplier_id') supplier_id?: string,
    @CurrentUser() user?: User,
  ): Promise<ApiResponse<unknown[]>> {
    const data = await this.quotationService.findAll(projectId, user!.id, { trade, supplier_id });
    return { success: true, data, error: null };
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user?: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.quotationService.findOne(id, user!.id);
    return { success: true, data, error: null };
  }

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateQuotationDto,
    @CurrentUser() user?: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.quotationService.create(projectId, dto, user!.id);
    return { success: true, data, error: null };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateQuotationDto,
    @CurrentUser() user?: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.quotationService.update(id, dto, user!.id);
    return { success: true, data, error: null };
  }
}
