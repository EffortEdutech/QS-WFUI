/**
 * Real implementation: core.cron_trigger
 *
 * A trigger node that fires on a cron schedule. When executed as part of a
 * normal (manual) run it behaves as an immediate trigger — returning the
 * current timestamp and the configured cron expression. The scheduler
 * integration in ExecutionService uses `getScheduledWorkflows()` to find
 * workflows that have this node and enqueue them.
 *
 * Inputs:  none (it is a source/trigger node)
 * Outputs:
 *   triggered_at      — ISO timestamp of when the trigger fired
 *   cron_expression   — the configured cron expression
 *   timezone          — the configured timezone
 *
 * Config:
 *   cron_expression   (string, required) — e.g. "0 8 * * 1-5"
 *   timezone          (string, default 'Asia/Kuala_Lumpur')
 *   description       (string, optional) — human label shown in UI
 *
 * Sprint 18 (S18-003)
 */
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

// Minimal cron-expression parser — computes a human-readable "next run" string.
// We don't bring in a full library to keep the bundle lean. For production
// scheduling, wire up a job runner that calls the /workflows/scheduled endpoint.
function describeCron(expr: string): string {
  if (!expr) return 'Invalid cron expression';
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;

  const [min, hour, dom, month, dow] = parts;
  const monthNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dowNames   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Common patterns
  if (expr === '* * * * *')              return 'Every minute';
  if (expr.match(/^\d+ \* \* \* \*$/))  return `Every hour at :${min!.padStart(2,'0')}`;
  if (expr.match(/^\d+ \d+ \* \* \*$/)) return `Daily at ${hour!.padStart(2,'0')}:${min!.padStart(2,'0')}`;
  if (expr.match(/^\d+ \d+ \* \* \d+$/))
    return `Every ${dowNames[parseInt(dow!, 10)] ?? dow} at ${hour!.padStart(2,'0')}:${min!.padStart(2,'0')}`;
  if (dom === '*' && month !== '*')
    return `Monthly (month ${monthNames[parseInt(month!, 10)] ?? month}) at ${hour!.padStart(2,'0')}:${min!.padStart(2,'0')}`;

  return `Cron: ${expr}`;
}

export async function realCronTrigger(
  ctx: NodeContext,
): Promise<NodeExecuteResult> {
  const cronExpression = ((ctx.config['cron_expression'] as string | undefined) ?? '').trim();
  const timezone       = ((ctx.config['timezone']        as string | undefined) ?? 'Asia/Kuala_Lumpur').trim();
  const description    = ((ctx.config['description']     as string | undefined) ?? '').trim();

  if (!cronExpression) {
    return {
      status: 'failure',
      outputs: {},
      logs: [],
      error: {
        code:    'MISSING_CRON_EXPRESSION',
        message: 'cron_expression config is required. Example: "0 8 * * 1-5" (weekdays at 08:00).',
      },
    };
  }

  const triggeredAt = new Date().toISOString();
  const readable    = describeCron(cronExpression);

  ctx.logger.info(`Cron trigger fired — ${cronExpression} (${timezone})`);
  ctx.logger.info(`Schedule: ${readable}`);
  ctx.logger.info(`Triggered at: ${triggeredAt}`);

  if (description) {
    ctx.logger.info(`Description: ${description}`);
  }

  const summary = description
    ? `Cron triggered: ${description} [${readable}]`
    : `Cron triggered: ${readable}`;

  return {
    status: 'success',
    outputs: {
      triggered_at:    triggeredAt,
      cron_expression: cronExpression,
      timezone,
      schedule_label:  readable,
    },
    logs: [],
    summary,
  };
}
