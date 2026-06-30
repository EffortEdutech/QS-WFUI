/**
 * @lados/testing — MockEventPublisher
 *
 * Records LadosEvent objects emitted during test execution.
 * Pass an instance to services that accept an EventPublisher interface,
 * then assert on `.published` after running the executor.
 */

import type { LadosEvent } from '@lados/core';

// ── EventPublisher interface ──────────────────────────────────────────────────
//
// Matches the interface expected by pack services that publish events.
// Keep this minimal — the test double only needs publish().

export interface EventPublisher {
  publish(event: LadosEvent): Promise<void>;
}

// ── Mock implementation ───────────────────────────────────────────────────────

export class MockEventPublisher implements EventPublisher {
  /** All events that have been published, in order */
  readonly published: LadosEvent[] = [];

  /** Appends the event to the in-memory list (never throws) */
  async publish(event: LadosEvent): Promise<void> {
    this.published.push(event);
  }

  // ── Query helpers ─────────────────────────────────────────────────────────

  /** Total number of events published so far */
  get count(): number {
    return this.published.length;
  }

  /** Most recently published event, or undefined if none */
  lastEvent(): LadosEvent | undefined {
    return this.published[this.published.length - 1];
  }

  /**
   * All events matching a specific event type.
   *
   * @example
   * const created = publisher.byType('contractor.job.created');
   */
  byType(eventType: string): LadosEvent[] {
    return this.published.filter((e) => e.type === eventType);
  }

  /**
   * First event matching a specific event type, or undefined.
   */
  firstOfType(eventType: string): LadosEvent | undefined {
    return this.published.find((e) => e.type === eventType);
  }

  // ── Assertion helpers ─────────────────────────────────────────────────────

  /**
   * Throws if no event of the given type was published.
   *
   * @example
   * publisher.assertPublished('contractor.job.created');
   */
  assertPublished(eventType: string): void {
    const found = this.published.some((e) => e.type === eventType);
    if (!found) {
      const types = this.published.map((e) => e.type).join(', ') || '(none)';
      throw new Error(
        `Expected event "${eventType}" to be published, but got: ${types}`,
      );
    }
  }

  /**
   * Throws if any event of the given type was published.
   */
  assertNotPublished(eventType: string): void {
    const found = this.published.some((e) => e.type === eventType);
    if (found) {
      throw new Error(
        `Expected event "${eventType}" NOT to be published, but it was.`,
      );
    }
  }

  /**
   * Throws if the total number of published events doesn't match.
   */
  assertCount(expected: number): void {
    if (this.published.length !== expected) {
      throw new Error(
        `Expected ${expected} event(s) to be published, but got ${this.published.length}.`,
      );
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  /** Clears all recorded events. Useful between steps in a multi-step test. */
  reset(): void {
    this.published.splice(0, this.published.length);
  }
}
