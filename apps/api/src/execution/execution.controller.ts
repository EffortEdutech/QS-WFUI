/**
 * ExecutionController
 *
 * POST   /workflows/:workflowId/run       — trigger a new run
 * GET    /workflows/:workflowId/runs      — list recent runs
 * GET    /runs/:runId                     — run details
 * GET    /runs/:runId/logs               — per-node log entries
 */
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseJwtGuard as JwtAuthGuard } from '../common/guards/supabase-jwt.guard';
import { ExecutionService } from './execution.service';
import { TriggerRunDto } from './dto/trigger-run.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

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
