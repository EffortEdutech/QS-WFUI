/**
 * ApiKeyController — Phase 6
 *
 * POST   /api-keys               — create a new API key (raw key shown once)
 * GET    /api-keys               — list keys for an org (no hashes)
 * DELETE /api-keys/:id           — revoke a key
 *
 * All endpoints require JWT auth (human must manage keys; API keys cannot self-manage).
 */

import {
  Controller, Get, Post, Delete,
  Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { ApiKeyService, CreateApiKeyDto } from './api-key.service';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';

@UseGuards(SupabaseJwtGuard)
@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  create(
    @Query('organizationId') orgId: string,
    @Body() dto: CreateApiKeyDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.apiKeyService.create(orgId, req.user.id, dto);
  }

  @Get()
  list(
    @Query('organizationId') orgId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.apiKeyService.list(orgId, req.user.id);
  }

  @Delete(':id')
  revoke(
    @Param('id') keyId: string,
    @Query('organizationId') orgId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.apiKeyService.revoke(keyId, orgId, req.user.id);
  }
}
