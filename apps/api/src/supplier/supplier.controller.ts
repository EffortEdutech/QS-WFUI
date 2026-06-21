/**
 * SupplierController
 *
 * GET    /api/v1/organizations/:orgId/suppliers          — list (filter by trade, status)
 * POST   /api/v1/organizations/:orgId/suppliers          — create
 * GET    /api/v1/organizations/:orgId/suppliers/:id      — get one
 * PATCH  /api/v1/organizations/:orgId/suppliers/:id      — update
 * DELETE /api/v1/organizations/:orgId/suppliers/:id      — deactivate (soft)
 *
 * Sprint 17 (S17-002)
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import type { ApiResponse } from '@lados/shared-types';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Controller('organizations/:orgId/suppliers')
@UseGuards(SupabaseJwtGuard)
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Get()
  async findAll(
    @Param('orgId') orgId: string,
    @Query('trade') trade?: string,
    @Query('status') status?: string,
    @CurrentUser() user?: User,
  ): Promise<ApiResponse<unknown[]>> {
    const data = await this.supplierService.findAll(orgId, user!.id, { trade, status });
    return { success: true, data, error: null };
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user?: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.supplierService.findOne(id, user!.id);
    return { success: true, data, error: null };
  }

  @Post()
  async create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateSupplierDto,
    @CurrentUser() user?: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.supplierService.create(orgId, dto, user!.id);
    return { success: true, data, error: null };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user?: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.supplierService.update(id, dto, user!.id);
    return { success: true, data, error: null };
  }

  @Delete(':id')
  @HttpCode(200)
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user?: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.supplierService.deactivate(id, user!.id);
    return { success: true, data, error: null };
  }
}
