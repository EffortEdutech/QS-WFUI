import {
  Controller, Get, Post, Patch,
  Param, Body, UseGuards,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import type { ApiResponse } from '@lados/shared-types';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

/**
 * ProjectController
 *
 * All routes are nested under organizations:
 *   GET  /api/v1/organizations/:orgId/projects
 *   POST /api/v1/organizations/:orgId/projects
 *   GET  /api/v1/organizations/:orgId/projects/:id
 *   PATCH /api/v1/organizations/:orgId/projects/:id
 */
@Controller('organizations/:orgId/projects')
@UseGuards(SupabaseJwtGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  async findAll(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<unknown[]>> {
    const data = await this.projectService.findAllInOrg(orgId, user.id);
    return { success: true, data, error: null };
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.projectService.findOne(id, user.id);
    return { success: true, data, error: null };
  }

  @Post()
  async create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.projectService.create(orgId, dto, user.id);
    return { success: true, data, error: null };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.projectService.update(id, dto, user.id);
    return { success: true, data, error: null };
  }
}
