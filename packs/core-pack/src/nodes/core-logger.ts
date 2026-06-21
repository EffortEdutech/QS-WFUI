/**
 * Real implementation: core.logger
 *
 * Logs a message and optional data snapshot to the execution log.
 * Sprint 10 (S10-002 — fills the Logger node in the BOQ→RFQ template)
 */
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

export async function realLogger(ctx: NodeContext): Promise<NodeExecuteResult> {
  const message = (ctx.config['message'] as string | undefined) ?? 'Checkpoint reached';
  const level   = (ctx.config['level'] as 'info' | 'warn' | 'error' | undefined) ?? 'info';
  const data    = ctx.inputs;

  const logFn = ctx.logger[level] ?? ctx.logger.info;
  logFn(`${message}`);

  if (Object.keys(data).length > 0) {
    ctx.logger.info(`Data snapshot: ${JSON.stringify(data).slice(0, 500)}`);
  }

  return {
    status: 'success',
    outputs: {
      logged:   true,
      message,
      level,
      logged_at: new Date().toISOString(),
    },
    logs: [],
    summary: `Logged: "${message}"`,
  };
}
