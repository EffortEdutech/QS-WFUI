/**
 * @lados/testing — MockNodeContext
 *
 * Creates a fully typed NodeContext for use in unit tests.
 * All log calls are captured in `logs` so tests can assert on them.
 */

import type { NodeContext, NodeLogger } from '@lados/node-sdk';

// ── Log capture ───────────────────────────────────────────────────────────────

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface CapturedLog {
  level: LogLevel;
  message: string;
  data?: unknown;
}

// ── MockNodeContext result ─────────────────────────────────────────────────────

export interface MockNodeContext {
  /** The NodeContext to pass into the executor under test */
  ctx: NodeContext;
  /** All log calls captured during test execution */
  logs: CapturedLog[];
  /** Convenience: only info-level logs */
  infoLogs: () => CapturedLog[];
  /** Convenience: only warn-level logs */
  warnLogs: () => CapturedLog[];
  /** Convenience: only error-level logs */
  errorLogs: () => CapturedLog[];
  /** Clear all captured logs (useful for multi-step tests) */
  resetLogs: () => void;
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Partial override of NodeContext — all fields optional.
 * Deep-merges over the defaults so tests only specify what they care about.
 */
export type MockNodeContextOverrides = Partial<
  Omit<NodeContext, 'logger'>
> & {
  logger?: Partial<NodeLogger>;
};

/**
 * Creates a `NodeContext` populated with safe defaults for unit testing.
 *
 * @example
 * const { ctx, logs } = createMockNodeContext({
 *   config: { apiKey: 'test-key' },
 *   inputs: { contractId: 'c-001' },
 * });
 * const result = await myExecutor(ctx);
 * expect(result.status).toBe('success');
 * expect(logs.find(l => l.level === 'info')).toBeDefined();
 */
export function createMockNodeContext(
  overrides: MockNodeContextOverrides = {},
): MockNodeContext {
  const logs: CapturedLog[] = [];

  const defaultLogger: NodeLogger = {
    info(message: string, data?: unknown): void {
      logs.push({ level: 'info', message, data });
    },
    warn(message: string, data?: unknown): void {
      logs.push({ level: 'warn', message, data });
    },
    error(message: string, data?: unknown): void {
      logs.push({ level: 'error', message, data });
    },
    debug(message: string, data?: unknown): void {
      logs.push({ level: 'debug', message, data });
    },
  };

  // Merge caller-provided logger methods over the defaults
  const mergedLogger: NodeLogger = overrides.logger
    ? {
        ...defaultLogger,
        ...overrides.logger,
      }
    : defaultLogger;

  // Build the NodeContext — spread overrides last so callers can replace any field
  const { logger: _ignoredLogger, ...contextOverrides } = overrides;

  const ctx: NodeContext = {
    // V2 required fields
    nodeId: 'test-node-001',
    nodeType: 'test.mock',
    upstream: {},

    // Core execution fields
    executionId: 'test-exec-001',
    workflowId: 'test-workflow-001',
    projectId: 'test-project-001',
    organizationId: 'test-org-001',
    userId: 'test-user-001',

    // Payload fields
    config: {},
    inputs: {},
    variables: {},

    // Injected services (none by default)
    services: {},

    // Override everything except logger (merged separately above)
    ...contextOverrides,

    // Always use the merged logger
    logger: mergedLogger,
  };

  return {
    ctx,
    logs,
    infoLogs:  () => logs.filter((l) => l.level === 'info'),
    warnLogs:  () => logs.filter((l) => l.level === 'warn'),
    errorLogs: () => logs.filter((l) => l.level === 'error'),
    resetLogs: () => { logs.splice(0, logs.length); },
  };
}
