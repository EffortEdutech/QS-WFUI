/**
 * SchedulerService — Phase 10
 *
 * Polls `lados_event_subscriptions` every 60 seconds for cron-triggered
 * workflows and fires them when their cron expression matches the current time.
 *
 * Architecture:
 *   - Single setInterval at startup (no external cron library needed)
 *   - Cron expressions stored in `filter.cronExpression` on the subscription row
 *   - Fires via ExecutionQueueService (BullMQ) → falls back to in-process if Redis absent
 *   - Workflow snapshot loaded from published_version_id to ensure idempotency
 *
 * Supported cron syntax (standard 5-field: min hour day month weekday):
 *   *         — any value
 *   * /n      — every n steps (no space in real expr: asterisk-slash-n)
 *   n         — exact match
 *   n,m,o     — list match
 *
 * Design constraint: fires at most once per subscription per poll tick.
 * Idempotency note: each tick creates a new run record with unique ID — no dedup.
 * For production scale, replace with a distributed lock (e.g. Redis SETNX).
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { SupabaseService }       from '../common/supabase/supabase.service';
import { ExecutionQueueService } from '../queue/execution-queue.service';
import type { QSWorkflowDefinition } from '@lados/shared-types';

// ── Cron evaluator ────────────────────────────────────────────────────────────

/**
 * Returns true if the cron expression matches the given date.
 * Standard 5-field format: min hour dom month dow (no seconds field).
 */
function matchesCron(expr: string, now: Date): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return false;

  const [minField, hourField, domField, monField, dowField] = fields;

  const min  = now.getMinutes();
  const hour = now.getHours();
  const dom  = now.getDate();
  const mon  = now.getMonth() + 1;   // cron months are 1-indexed
  const dow  = now.getDay();          // 0=Sunday

  return (
    matchField(minField,  min,  0, 59) &&
    matchField(hourField, hour, 0, 23) &&
    matchField(domField,  dom,  1, 31) &&
    matchField(monField,  mon,  1, 12) &&
    matchField(dowField,  dow,  0,  6)
  );
}

function matchField(field: string, value: number, min: number, max: number): boolean {
  if (field === '*') return true;

  // */n — step
  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10);
    if (isNaN(step) || step <= 0) return false;
    return (value - min) % step === 0;
  }

  // n,m,o — list
  if (field.includes(',')) {
    return field.split(',').some((part) => {
      const n = parseInt(part.trim(), 10);
      return !isNaN(n) && value === n;
    });
  }

  // plain number
  const n = parseInt(field, 10);
  return !isNaN(n) && value === n;
}

// ── Service ───────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60_000; // 1 minute

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly supabase:       SupabaseService,
    private readonly executionQueue: ExecutionQueueService,
  ) {}

  onModuleInit(): void {
    this.logger.log('SchedulerService: starting cron poll (60s interval)');
    // Align to the next whole minute, then run every 60s
    const msUntilNextMinute = POLL_INTERVAL_MS - (Date.now() % POLL_INTERVAL_MS);
    setTimeout(() => {
      void this.tick();
      this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
    }, msUntilNextMinute);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // ── Internal tick ─────────────────────────────────────────────────────────

  private async tick(): Promise<void> {
    const now = new Date();
    this.logger.debug(`SchedulerService: tick at ${now.toISOString()}`);

    try {
      // Fetch all active cron subscriptions
      const { data: subs, error } = await this.supabase.admin
        .from('lados_event_subscriptions')
        .select('id, org_id, workflow_id, filter')
        .eq('event_type', 'cron_trigger')
        .eq('active', true);

      if (error) {
        this.logger.warn(`SchedulerService: query error — ${error.message}`);
        return;
      }

      if (!subs?.length) return;

      for (const sub of subs) {
        const filter = sub.filter as Record<string, unknown> | null;
        const cronExpression = filter?.['cronExpression'] as string | undefined;

        if (!cronExpression) {
          this.logger.warn(`SchedulerService: subscription ${sub.id as string} missing cronExpression`);
          continue;
        }

        if (!matchesCron(cronExpression, now)) continue;

        await this.fireWorkflow(
          sub.workflow_id as string,
          sub.org_id as string,
          cronExpression,
        );
      }
    } catch (err) {
      this.logger.error(`SchedulerService: tick error — ${(err as Error).message}`);
    }
  }

  // ── Fire a scheduled workflow run ─────────────────────────────────────────

  private async fireWorkflow(
    workflowId:     string,
    orgId:          string,
    cronExpression: string,
  ): Promise<void> {
    try {
      // 1. Load workflow + published snapshot
      const { data: workflow, error: wfErr } = await this.supabase.admin
        .from('workflows')
        .select('id, project_id, published_version_id, status')
        .eq('id', workflowId)
        .single();

      if (wfErr || !workflow) {
        this.logger.warn(`SchedulerService: workflow ${workflowId} not found — skipping`);
        return;
      }

      if (!workflow.published_version_id) {
        this.logger.warn(
          `SchedulerService: workflow ${workflowId} has no published version — skipping`,
        );
        return;
      }

      const { data: snap } = await this.supabase.admin
        .from('workflow_versions')
        .select('definition')
        .eq('id', workflow.published_version_id as string)
        .single();

      if (!snap?.definition) {
        this.logger.warn(`SchedulerService: no definition found for workflow ${workflowId} v${workflow.published_version_id as string}`);
        return;
      }

      const definition = snap.definition as QSWorkflowDefinition;

      // 2. Create run record
      const { data: run, error: runErr } = await this.supabase.admin
        .from('execution_runs')
        .insert({
          workflow_id:      workflowId,
          project_id:       workflow.project_id,
          organization_id:  orgId,
          workflow_snapshot: definition,
          status:           'running',
          trigger_type:     'schedule',
          inputs:           { cron_expression: cronExpression, fired_at: new Date().toISOString() },
          started_by:       'system',
          started_at:       new Date().toISOString(),
        })
        .select('id')
        .single();

      if (runErr || !run) {
        this.logger.error(`SchedulerService: failed to create run for workflow ${workflowId}: ${runErr?.message}`);
        return;
      }

      const runId = run.id as string;

      // 3. Enqueue via BullMQ (falls back to in-process if Redis absent)
      await this.executionQueue.enqueueTrigger({
        runId,
        workflowId,
        projectId: workflow.project_id as string,
        orgId,
        userId:    'system',
      });

      this.logger.log(
        `SchedulerService: fired workflow ${workflowId} (run ${runId}) via cron "${cronExpression}"`,
      );
    } catch (err) {
      this.logger.error(
        `SchedulerService: failed to fire workflow ${workflowId}: ${(err as Error).message}`,
      );
    }
  }
}
