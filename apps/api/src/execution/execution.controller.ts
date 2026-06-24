/**
 * ExecutionController — Phase 12 (Async Execution Queue)
 *
 * POST   /workflows/:workflowId/run       — trigger a new run
 * GET    /workflows/:workflowId/runs      — list recent runs
 * GET    /runs/:runId                     — run details
 * GET    /runs/:runId/logs               — per-node log entries
 * GET    /runs/:runId/stream             — SSE progress stream (Phase 12)
 */
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Sse,
  UseGuards,
  Request,
  BadRequestException,
  MessageEvent,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, fromEvent, merge, timer } from 'rxjs';
import { map, takeUntil, filter } from 'rxjs/operators';
import { SupabaseJwtGuard as JwtAuthGuard } from '../common/guards/supabase-jwt.guard';
import { ExecutionService } from './execution.service';
import { TriggerRunDto } from './dto/trigger-run.dto';
import { RUN_EVENT } from '../queue/queue.constants';

@Controller()
@UseGuards(JwtAuthGuard)
export class ExecutionController {
  constructor(
    private readonly executionService: ExecutionService,
    private readonly emitter: EventEmitter2,
  ) {}

  /** Trigger a workflow run */
  @Post('workflows/:workflowId/run')
  async triggerRun(
    @Param('workflowId') workflowId: string,
    @Body() dto: TriggerRunDto,
    @Request() req: { user: { id: string } },
  ) {
    const result = await this.executionService.triggerRun(workflowId, dto, req.user.id);
    return { success: true, data: result };
  }

  /** List recent runs for a workflow */
  @Get('workflows/:workflowId/runs')
  async listRuns(
    @Param('workflowId') workflowId: string,
    @Request() req: { user: { id: string } },
  ) {
    const runs = await this.executionService.listRunsForWorkflow(workflowId, req.user.id);
    return { success: true, data: runs };
  }

  /** Get run details */
  @Get('runs/:runId')
  async getRun(
    @Param('runId') runId: string,
    @Request() req: { user: { id: string } },
  ) {
    const run = await this.executionService.getRun(runId, req.user.id);
    return { success: true, data: run };
  }

  /** Get per-node log entries for a run */
  @Get('runs/:runId/logs')
  async getRunLogs(
    @Param('runId') runId: string,
    @Request() req: { user: { id: string } },
  ) {
    const logs = await this.executionService.getRunLogs(runId, req.user.id);
    return { success: true, data: logs };
  }

  /**
   * Execute a single pack node directly on a resource (inline action).
   *
   * Called by the /resources UI when a non-state.change action button is clicked.
   * No workflow record is required — the node is resolved from the pack registry
   * and executed with a minimal NodeContext.
   *
   * POST /resources/:id/execute-action?organizationId=<orgId>
   * Body: { node: "contractor.dispatch_trip", inputs: { jobId, vehicleId, driverId } }
   */
  @Post('resources/:id/execute-action')
  async executeResourceAction(
    @Param('id') resourceId: string,
    @Body() body: { node: string; inputs?: Record<string, unknown> },
    @Query('organizationId') orgId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!body?.node) throw new BadRequestException('node is required');
    if (!orgId)      throw new BadRequestException('organizationId query param is required');

    const result = await this.executionService.executeNodeAction(
      body.node,
      orgId,
      resourceId,
      body.inputs ?? {},
      req.user.id,
    );

    return { success: result.status !== 'failure', data: result };
  }

  /**
   * SSE progress stream for a run — Phase 12.
   *
   * Client subscribes to GET /runs/:runId/stream.
   * Emits MessageEvents as the worker processes nodes.
   * Stream closes automatically on run_complete / run_paused / run_failed,
   * or after a 10-minute safety timeout.
   *
   * Falls back gracefully: if Redis is not connected the worker still emits
   * events in-process via EventEmitter2, so SSE works in dev without Redis too.
   */
  @Sse('runs/:runId/stream')
  streamRun(
    @Param('runId') runId: string,
  ): Observable<MessageEvent> {
    // Terminal events that close the stream
    const terminalEvents = [RUN_EVENT.RUN_COMPLETE, RUN_EVENT.RUN_PAUSED, RUN_EVENT.RUN_FAILED];

    // Safety timeout — close after 10 min regardless
    const timeout$ = timer(10 * 60 * 1000);

    // Merge all run events, filter to this runId, map to MessageEvent
    const events$ = merge(
      fromEvent(this.emitter, RUN_EVENT.NODE_STARTED),
      fromEvent(this.emitter, RUN_EVENT.NODE_DONE),
      fromEvent(this.emitter, RUN_EVENT.RUN_COMPLETE),
      fromEvent(this.emitter, RUN_EVENT.RUN_PAUSED),
      fromEvent(this.emitter, RUN_EVENT.RUN_FAILED),
    ).pipe(
      filter((payload: unknown) => (payload as { runId: string }).runId === runId),
      map((payload: unknown): MessageEvent => ({
        data: JSON.stringify(payload),
        type: 'message',
        id:   Date.now().toString(),
        retry: undefined,
      })),
      takeUntil(
        merge(
          timeout$,
          // Close on terminal events for this run
          merge(
            fromEvent(this.emitter, RUN_EVENT.RUN_COMPLETE),
            fromEvent(this.emitter, RUN_EVENT.RUN_PAUSED),
            fromEvent(this.emitter, RUN_EVENT.RUN_FAILED),
          ).pipe(
            filter((p: unknown) => (p as { runId: string }).runId === runId),
          ),
        ),
      ),
    );

    return events$;
  }

  /**
   * Latest qs.read_boq output for a project.
   * Returns the most recent completed node output so the BOQ table page
   * can render it without knowing which workflow or run it came from.
   * Sprint 16 (S16-005).
   */
  @Get('projects/:projectId/boq-latest')
  async getLatestBoq(
    @Param('projectId') projectId: string,
    @Request() req: { user: { id: string } },
  ) {
    const data = await this.executionService.getLatestBoq(projectId, req.user.id);
    return { success: true, data };
  }
}
