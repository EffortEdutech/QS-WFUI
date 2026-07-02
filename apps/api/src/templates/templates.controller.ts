/**
 * TemplatesController
 *
 * GET  /api/v1/workflow-templates         — list all active templates
 * POST /api/v1/workflow-templates/:id/instantiate — create workflow from template
 * Sprint 10 (S10-001)
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { SupabaseJwtGuard as JwtGuard } from '../common/guards/supabase-jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TemplatesService } from './templates.service';

interface InstantiateDto {
  projectId: string;
  name?: string;
}

@Controller('workflow-templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  // Public — template catalog is read-only, non-sensitive
  @Get()
  async listTemplates() {
    const data = await this.templates.list();
    return { success: true, data, error: null };
  }

  @Get(':id')
  async getTemplate(@Param('id') templateId: string) {
    const data = await this.templates.findOne(templateId);
    return { success: true, data, error: null };
  }

  @Post(':id/instantiate')
  @UseGuards(JwtGuard)
  @HttpCode(201)
  async instantiate(
    @Param('id') templateId: string,
    @Body() dto: InstantiateDto,
    @CurrentUser() user: User,
  ) {
    const data = await this.templates.instantiate(templateId, dto.projectId, dto.name, user.id);
    return { success: true, data, error: null };
  }
}
