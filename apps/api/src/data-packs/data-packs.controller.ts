import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { DataPacksService } from './data-packs.service';

@UseGuards(SupabaseJwtGuard)
@Controller('data-packs')
export class DataPacksController {
  constructor(private readonly dataPacks: DataPacksService) {}

  @Get()
  async list(
    @Request() req: AuthenticatedRequest,
    @Query('organizationId') organizationId?: string,
  ) {
    const data = await this.dataPacks.listDataPacks(req.user.id, organizationId);
    return { success: true, data };
  }

  @Get(':slug')
  async detail(
    @Param('slug') slug: string,
    @Request() req: AuthenticatedRequest,
    @Query('organizationId') organizationId?: string,
  ) {
    const data = await this.dataPacks.getDataPack(slug, req.user.id, organizationId);
    return { success: true, data };
  }

  @Get(':slug/versions/:version')
  async version(
    @Param('slug') slug: string,
    @Param('version') version: string,
    @Request() req: AuthenticatedRequest,
    @Query('organizationId') organizationId?: string,
  ) {
    const data = await this.dataPacks.getVersion(slug, version, req.user.id, organizationId);
    return { success: true, data };
  }

  @Post(':slug/install')
  async install(
    @Param('slug') slug: string,
    @Query('organizationId') organizationId: string,
    @Query('version') version: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!organizationId) throw new BadRequestException('organizationId query param is required');
    const data = await this.dataPacks.installDataPack(slug, organizationId, req.user.id, version);
    return { success: true, data };
  }

  @Delete(':slug')
  async uninstall(
    @Param('slug') slug: string,
    @Query('organizationId') organizationId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!organizationId) throw new BadRequestException('organizationId query param is required');
    const data = await this.dataPacks.uninstallDataPack(slug, organizationId, req.user.id);
    return { success: true, data };
  }
}

@UseGuards(SupabaseJwtGuard)
@Controller('org')
export class OrgDataPacksController {
  constructor(private readonly dataPacks: DataPacksService) {}

  @Get('data-packs')
  async installed(
    @Query('organizationId') organizationId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!organizationId) throw new BadRequestException('organizationId query param is required');
    const data = await this.dataPacks.listInstalledDataPacks(organizationId, req.user.id);
    return { success: true, data };
  }
}

@UseGuards(SupabaseJwtGuard)
@Controller('data-pack-items')
export class DataPackItemsController {
  constructor(private readonly dataPacks: DataPacksService) {}

  @Get('search')
  async search(
    @Query('organizationId') organizationId: string,
    @Query('q') q: string | undefined,
    @Query('collection') collection: string | undefined,
    @Query('packSlug') packSlug: string | undefined,
    @Query('region') region: string | undefined,
    @Query('tag') tag: string | undefined,
    @Query('limit') limit: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!organizationId) throw new BadRequestException('organizationId query param is required');
    const data = await this.dataPacks.searchItems({
      organizationId,
      userId: req.user.id,
      q,
      collection,
      packSlug,
      region,
      tag,
      limit: limit ? Number(limit) : undefined,
    });
    return { success: true, data };
  }

  @Get(':itemId')
  async detail(
    @Param('itemId') itemId: string,
    @Request() req: AuthenticatedRequest,
    @Query('organizationId') organizationId?: string,
  ) {
    const data = await this.dataPacks.getItem(itemId, req.user.id, organizationId);
    return { success: true, data };
  }
}
