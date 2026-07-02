import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { SecurityEngineService } from '../security/security.service';
import { RegistryService } from './registry.service';

@UseGuards(SupabaseJwtGuard)
@Controller('registry')
export class RegistryController {
  constructor(
    private readonly registry: RegistryService,
    private readonly security: SecurityEngineService,
  ) {}

  @Post('packs/submit')
  @UseInterceptors(FileInterceptor('bundle', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async submitPack(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: AuthenticatedRequest,
  ) {
    const data = await this.registry.submitPack(file, req.user.id);
    return { success: true, data };
  }

  @Get('packs')
  async listPacks(
    @Query('q') q?: string,
    @Query('tag') tag?: string,
    @Query('official') official?: string,
    @Query('verified') verified?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const data = await this.registry.listPacks({
      q,
      tag,
      official: official === undefined ? undefined : official === 'true',
      verified: verified === undefined ? true : verified !== 'false',
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return { success: true, data };
  }

  @Get('packs/:packId')
  async getPackVersions(@Param('packId') packId: string) {
    const data = await this.registry.getPackVersions(packId);
    return { success: true, data };
  }

  @Get('packs/:packId/:version')
  async getPackVersion(
    @Param('packId') packId: string,
    @Param('version') version: string,
  ) {
    const data = await this.registry.getPackVersion(packId, version);
    return { success: true, data };
  }

  @Patch('packs/:listingId/verify')
  async verifyPack(
    @Param('listingId') listingId: string,
    @Query('organizationId') organizationId: string,
    @Body() body: { approved?: boolean; note?: string },
    @Request() req: AuthenticatedRequest,
  ) {
    if (!organizationId) throw new BadRequestException('organizationId query param is required');
    await this.security.requirePermission(req.user.id, organizationId, 'registry.verify');
    const data = await this.registry.verifyListing(
      listingId,
      body.approved === true,
      req.user.id,
      body.note,
    );
    return { success: true, data };
  }
}
