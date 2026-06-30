/**
 * EventBusController — Phase 4 / Phase 3A
 *
 * GET    /events                          — query event history
 * GET    /events/correlation/:id          — events by correlation_id
 * GET    /events/run/:runId               — events by run_id
 * GET    /events/subscriptions            — list event subscriptions
 * POST   /events/subscriptions            — create an event subscription
 * PATCH  /events/subscriptions/:id        — enable / disable a subscription
 * DELETE /events/subscriptions/:id        — delete a subscription
 */
import {
  Controller, Get, Post, Patch, Delete,
  Query, Body, Param, UseGuards, Request,
  BadRequestException,
} from '@nestjs/common';
import { IsString, IsUUID, IsOptional, IsBoolean, IsObject, MinLength } from 'class-validator';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { EventBusService } from './event-bus.service';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';

class CreateSubscriptionDto {
  @IsString() @MinLength(1) eventType!: string;
  @IsUUID()                 workflowId!: string;
  @IsOptional() @IsObject() filter?: Record<string, unknown>;
}

class PatchSubscriptionDto {
  @IsBoolean() active!: boolean;
}

@UseGuards(SupabaseJwtGuard)
@Controller('events')
export class EventBusController {
  constructor(private readonly eventBus: EventBusService) {}

  private requireOrg(orgId: string | undefined): string {
    if (!orgId) throw new BadRequestException('organizationId query param is required');
    return orgId;
  }

  // ── Event log ─────────────────────────────────────────────────────────────

  @Get()
  getEvents(
    @Query('organizationId') orgId: string,
    @Query('type')           type?: string,
    @Query('sourceType')     sourceType?: string,
    @Query('sourceId')       sourceId?: string,
    @Query('actorId')        actorId?: string,
    @Query('from')           from?: string,
    @Query('to')             to?: string,
    @Query('limit')          limitStr?: string,
  ) {
    return this.eventBus.getEvents(this.requireOrg(orgId), {
      type, sourceType, sourceId, actorId, from, to,
      limit: limitStr ? parseInt(limitStr, 10) : undefined,
    });
  }

  // ── Correlation / run shortcuts ───────────────────────────────────────────

  @Get('correlation/:correlationId')
  getByCorrelation(
    @Param('correlationId') correlationId: string,
    @Query('organizationId') orgId: string,
    @Query('limit') limitStr?: string,
  ) {
    return this.eventBus.getEvents(this.requireOrg(orgId), {
      correlationId,
      limit: limitStr ? parseInt(limitStr, 10) : undefined,
    });
  }

  @Get('run/:runId')
  getByRun(
    @Param('runId') runId: string,
    @Query('organizationId') orgId: string,
    @Query('limit') limitStr?: string,
  ) {
    return this.eventBus.getEvents(this.requireOrg(orgId), {
      runId,
      limit: limitStr ? parseInt(limitStr, 10) : undefined,
    });
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────

  @Get('subscriptions')
  listSubscriptions(@Query('organizationId') orgId: string) {
    return this.eventBus.listSubscriptions(this.requireOrg(orgId));
  }

  @Post('subscriptions')
  createSubscription(
    @Body() dto: CreateSubscriptionDto,
    @Query('organizationId') orgId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.eventBus.subscribe({
      orgId:      this.requireOrg(orgId),
      eventType:  dto.eventType,
      workflowId: dto.workflowId,
      filter:     dto.filter,
      createdBy:  req.user.id,
    });
  }

  @Patch('subscriptions/:id')
  patchSubscription(
    @Param('id') id: string,
    @Body() dto: PatchSubscriptionDto,
    @Query('organizationId') orgId: string,
  ) {
    return this.eventBus.setSubscriptionActive(id, this.requireOrg(orgId), dto.active);
  }

  @Delete('subscriptions/:id')
  deleteSubscription(
    @Param('id') id: string,
    @Query('organizationId') orgId: string,
  ) {
    return this.eventBus.unsubscribe(id, this.requireOrg(orgId));
  }
}
