/**
 * StateEngineController — Phase 5 / Phase 3C
 *
 * GET  /state-machines                                         — list machines for an org
 * GET  /state-machines/:resourceType/transitions?from=<state>  — available transitions
 * GET  /state-machines/:resourceType                           — effective machine definition
 * POST /state-machines                                         — create org-specific override
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

  @Get(':resourceType/transitions')
  async getAvailableTransitions(
    @Param('resourceType') resourceType: string,
    @Query('organizationId') orgId: string,
    @Query('from') fromState: string,
  ) {
    if (!fromState) throw new BadRequestException('from query param is required');
    const data = await this.stateEngine.getAvailableTransitions(
      resourceType, fromState, this.requireOrg(orgId),
    );
    return { success: true, data };
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
