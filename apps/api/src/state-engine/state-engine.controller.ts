/**
 * StateEngineController — Phase 5
 *
 * GET  /state-machines                — list machines for an org (system + org-specific)
 * GET  /state-machines/:resourceType  — get effective machine for a resource type
 * POST /state-machines                — create org-specific override machine
 */
import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, BadRequestException,
} from '@nestjs/common';
import { IsString, IsObject, MinLength } from 'class-validator';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { StateEngineService } from './state-engine.service';
import type { StateMachineDefinition } from './state-engine.types';

class CreateMachineDto {
  @IsString() @MinLength(1) resourceType!: string;
  @IsObject() definition!: StateMachineDefinition;
}

@UseGuards(SupabaseJwtGuard)
@Controller('state-machines')
export class StateEngineController {
  constructor(private readonly stateEngine: StateEngineService) {}

  private requireOrg(orgId: string | undefined): string {
    if (!orgId) throw new BadRequestException('organizationId query param is required');
    return orgId;
  }

  @Get()
  listMachines(@Query('organizationId') orgId: string) {
    return this.stateEngine.listMachines(this.requireOrg(orgId));
  }

  @Get(':resourceType')
  getMachine(
    @Param('resourceType') resourceType: string,
    @Query('organizationId') orgId: string,
  ) {
    return this.stateEngine.getMachineForType(resourceType, this.requireOrg(orgId));
  }

  @Post()
  createMachine(
    @Body() dto: CreateMachineDto,
    @Query('organizationId') orgId: string,
  ) {
    return this.stateEngine.createMachine({
      orgId:        this.requireOrg(orgId),
      resourceType: dto.resourceType,
      definition:   dto.definition,
    });
  }
}
