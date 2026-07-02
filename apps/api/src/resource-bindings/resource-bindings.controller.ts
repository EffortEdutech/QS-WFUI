import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import type { ApiResponse, ResourceBinding } from '@lados/shared-types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { UpsertBindingDto } from './dto/upsert-binding.dto';
import { ResourceBindingsService } from './resource-bindings.service';

@Controller('workflows/:workflowId/bindings')
@UseGuards(SupabaseJwtGuard)
export class ResourceBindingsController {
  constructor(private readonly bindings: ResourceBindingsService) {}

  @Get()
  async list(
    @Param('workflowId') workflowId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<ResourceBinding[]>> {
    const data = await this.bindings.listBindings(workflowId, user.id);
    return { success: true, data, error: null };
  }

  @Put(':nodeId/:bindingKey')
  async upsert(
    @Param('workflowId') workflowId: string,
    @Param('nodeId') nodeId: string,
    @Param('bindingKey') bindingKey: string,
    @Body() dto: UpsertBindingDto,
    @CurrentUser() user: User,
  ): Promise<ApiResponse<ResourceBinding>> {
    const data = await this.bindings.upsertBinding(
      workflowId,
      nodeId,
      bindingKey,
      dto.resourceId,
      dto.resourceType,
      user.id,
    );
    return { success: true, data, error: null };
  }

  @Delete(':nodeId/:bindingKey')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('workflowId') workflowId: string,
    @Param('nodeId') nodeId: string,
    @Param('bindingKey') bindingKey: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.bindings.deleteBinding(workflowId, nodeId, bindingKey, user.id);
  }
}
