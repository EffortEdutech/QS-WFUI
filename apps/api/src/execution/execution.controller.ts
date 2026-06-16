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
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
}
