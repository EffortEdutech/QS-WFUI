import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { NodeService } from './node.service';

@Controller('nodes')
@UseGuards(SupabaseJwtGuard)
export class NodeController {
  constructor(private readonly nodeService: NodeService) {}

  /** GET /api/v1/nodes — list all nodes, optionally ?category=qs or ?pack=lados.qs-pack */
  @Get()
  async findAll(
    @Query('category') category?: string,
    @Query('pack') packId?: string,
  ) {
    const nodes = await this.nodeService.findAll({ category, packId });
    return { success: true, data: nodes, error: null };
  }

  /** GET /api/v1/nodes/packs — list all packs with skill count */
  @Get('packs')
  async findAllPacks() {
    const packs = await this.nodeService.findAllPacks();
    return { success: true, data: packs, error: null };
  }

  /** GET /api/v1/nodes/search?q= — server-side skill search (Sprint 15) */
  @Get('search')
  async search(@Query('q') q?: string) {
    const results = await this.nodeService.search(q ?? '');
    return { success: true, data: results, error: null };
  }

  /** GET /api/v1/nodes/:type — get one node definition */
  @Get(':type')
  async findOne(@Param('type') type: string) {
    const node = await this.nodeService.findOne(type);
    return { success: true, data: node, error: null };
  }

  /** GET /api/v1/nodes/:type/ui-schema */
  @Get(':type/ui-schema')
  async getUISchema(@Param('type') type: string) {
    const schema = await this.nodeService.getUISchema(type);
    return { success: true, data: schema, error: null };
  }

  /** POST /api/v1/nodes/:type/validate-config */
  @Post(':type/validate-config')
  async validateConfig(
    @Param('type') type: string,
    @Body() body: { config: Record<string, unknown> },
  ) {
    const result = await this.nodeService.validateConfig(type, body.config ?? {});
    return { success: true, data: result, error: null };
  }
}
