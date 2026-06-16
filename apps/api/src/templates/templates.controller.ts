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
  Request,
  HttpCode,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { TemplatesService } from './templates.service';

interface InstantiateDto {
  projectId: string;
  name?: string;
}

@Controller('workflow-templates')
@UseGuards(JwtGuard)
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  listTemplates() {
    return this.templates.list();
  }

  @Post(':id/instantiate')
  @HttpCode(201)
  instantiate(
    @Param('id') templateId: string,
    @Body() dto: InstantiateDto,
    @Request() req: { user: { sub: string } },
  ) {
    return this.templates.instantiate(templateId, dto.projectId, dto.name, req.user.sub);
  }
}
