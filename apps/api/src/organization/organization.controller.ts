import {
  Controller, Get, Post, Patch,
  Param, Body, UseGuards,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import type { ApiResponse } from '@lados/shared-types';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Controller('organizations')
@UseGuards(SupabaseJwtGuard)
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  /** GET /api/v1/organizations — list orgs the user belongs to */
  @Get()
  async findAll(@CurrentUser() user: User): Promise<ApiResponse<unknown[]>> {
    const data = await this.orgService.findAllForUser(user.id);
    return { success: true, data, error: null };
  }

  /** GET /api/v1/organizations/:id */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.orgService.findOne(id, user.id);
    return { success: true, data, error: null };
  }

  /** POST /api/v1/organizations */
  @Post()
  async create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.orgService.create(dto, user.id);
    return { success: true, data, error: null };
  }

  /** PATCH /api/v1/organizations/:id */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.orgService.update(id, dto, user.id);
    return { success: true, data, error: null };
  }
}
