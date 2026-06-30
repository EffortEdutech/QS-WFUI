/**
 * core.delay
 *
 * Pauses workflow execution for a specified number of milliseconds, then
 * continues. Useful for rate-limiting API calls, adding grace periods
 * between steps, or building simple back-off logic.
 *
 * ⚠  This is a real async sleep — the workflow runner awaits this node
 *    fully before proceeding. For very long waits (minutes/hours), use a
 *    `core.human_approval` gate or a scheduled re-trigger instead.
 *
 * Config / Inputs:
 *   delay_ms  — milliseconds to wait (required; clamped to 0–300_000 ms = 5 min)
 *
 * Outputs:
 *   delay_ms     — actual delay applied
 *   delayed_at   — ISO timestamp when the delay started
 *   resumed_at   — ISO timestamp when execution resumed
 *
 * Phase 10
 */
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

/** Hard ceiling: 5 minutes. Longer waits should use a scheduler / approval gate. */
const MAX_DELAY_MS = 5 * 60 * 1000;

export async function realDelay(ctx: NodeContext): Promise<NodeExecuteResult> {
  const raw = (ctx.inputs['delay_ms'] ?? ctx.config['delay_ms']) as number | string | undefined;

  if (raw === undefined || raw === null || raw === '') {
    return {
      status: 'failure',
      outputs: {},
      error: { code: 'MISSING_INPUT', message: 'core.delay: delay_ms is required' },
    };
  }

  const requestedMs = Number(raw);
  if (!isFinite(requestedMs) || requestedMs < 0) {
    return {
      status: 'failure',
      outputs: {},
      error: { code: 'INVALID_INPUT', message: `core.delay: delay_ms must be a non-negative number (got ${raw})` },
    };
  }

  const delayMs   = Math.min(Math.round(requestedMs), MAX_DELAY_MS);
  const delayedAt = new Date().toISOString();

  if (delayMs !== requestedMs) {
    ctx.logger.warn(
      `core.delay: requested ${requestedMs}ms exceeds ceiling of ${MAX_DELAY_MS}ms — clamped to ${delayMs}ms`,
    );
  }

  ctx.logger.info(`core.delay: sleeping ${delayMs}ms (started ${delayedAt})`);

  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));

  const resumedAt = new Date().toISOString();
  ctx.logger.info(`core.delay: resumed at ${resumedAt}`);

  return {
    status: 'success',
    outputs: {
      delay_ms:   delayMs,
      delayed_at: delayedAt,
      resumed_at: resumedAt,
    },
    summary: `Delayed ${delayMs}ms`,
  };
}
