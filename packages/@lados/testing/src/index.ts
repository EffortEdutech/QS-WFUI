/**
 * @lados/testing
 *
 * Test utilities for LADOS V4 node executors.
 *
 * @example
 * import { createMockNodeContext, MockEventPublisher } from '@lados/testing';
 *
 * const { ctx, logs } = createMockNodeContext({ config: { apiKey: 'k' } });
 * const publisher = new MockEventPublisher();
 * const result = await myExecutor(ctx);
 * publisher.assertPublished('my.event.type');
 */

// ── MockNodeContext ────────────────────────────────────────────────────────────
export type {
  LogLevel,
  CapturedLog,
  MockNodeContext,
  MockNodeContextOverrides,
} from './mock-node-context';

export { createMockNodeContext } from './mock-node-context';

// ── MockEventPublisher ────────────────────────────────────────────────────────
export type { EventPublisher } from './mock-event-publisher';
export { MockEventPublisher } from './mock-event-publisher';
