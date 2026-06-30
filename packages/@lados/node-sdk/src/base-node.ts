/**
 * @lados/node-sdk — BaseNode abstract class
 *
 * All concrete node implementations extend BaseNode and implement:
 *   - get manifest(): NodeManifestV2   (static declaration)
 *   - execute(ctx): Promise<NodeExecuteResult>
 *
 * The three protected helpers — success(), failure(), pause() — cover
 * the vast majority of node return patterns without boilerplate.
 *
 * V2 changes from V1:
 *  - `manifest` is now a getter property (was `getManifest()` method)
 *  - `pause()` replaces `pendingApproval()` for clarity
 *  - `validate()` uses V2 ConfigField shape (key, label, required)
 *  - `onSuccess` / `onFailure` lifecycle hooks removed (use services instead)
 *
 * See: docs/Lados/03_LCE_SDK.md §2.5
 */

import type { NodeManifestV2 } from '@lados/core';
import type {
  NodeContext,
  NodeExecuteResult,
  NodeValidationResult,
  ValidationIssue,
  NodeError,
  PausePayload,
} from './types';

export abstract class BaseNode {
  // ── Abstract contract ─────────────────────────────────────────────────────

  /**
   * The static V2 manifest declaring this node's identity, ports,
   * config schema, resource requirements, and events.
   *
   * Implement as a getter so it can reference `this` if needed:
   *
   * ```ts
   * get manifest(): NodeManifestV2 {
   *   return { type: 'fleet.assign_vehicle', ... };
   * }
   * ```
   */
  abstract get manifest(): NodeManifestV2;

  /**
   * Execute the node with the given context.
   * Must return a NodeExecuteResult — use the helpers below.
   */
  abstract execute(ctx: NodeContext): Promise<NodeExecuteResult>;

  // ── Default validation ────────────────────────────────────────────────────

  /**
   * Validate config and inputs before execution.
   *
   * Default implementation: checks that required config fields are
   * present and non-empty. Override for custom business-rule validation.
   *
   * The engine calls validate() before execute() if it is overridden.
   */
  validate(ctx: NodeContext): NodeValidationResult {
    const { config: configSchema } = this.manifest;
    const issues: ValidationIssue[] = [];

    for (const field of configSchema) {
      if (field.required === true) {
        const value = ctx.config[field.key];
        const missing =
          value === undefined ||
          value === null ||
          (typeof value === 'string' && value.trim() === '');

        if (missing) {
          issues.push({
            field: field.key,
            severity: 'error',
            message: `"${field.label}" is required`,
          });
        }
      }
    }

    return { valid: issues.length === 0, issues };
  }

  // ── Result helpers ────────────────────────────────────────────────────────

  /**
   * Return a successful result.
   *
   * @example
   *   return this.success({ vehicleId: '...', assigned: true }, 'Vehicle assigned');
   */
  protected success(
    outputs: Record<string, unknown>,
    summary?: string,
  ): NodeExecuteResult {
    return { status: 'success', outputs, summary };
  }

  /**
   * Return a failure result with a structured error.
   *
   * @example
   *   return this.failure('RESOURCE_NOT_FOUND', 'Vehicle not found', { vehicleId });
   */
  protected failure(
    code: string,
    message: string,
    details?: unknown,
  ): NodeExecuteResult {
    const error: NodeError = { code, message, details };
    return { status: 'failure', outputs: {}, error };
  }

  /**
   * Return a paused result that halts the run pending human action.
   *
   * The runner persists a checkpoint and creates an approval_task record.
   * Pass any partial outputs already produced before the pause.
   *
   * @example
   *   return this.pause(
   *     { draftInvoiceId: invoice.id },
   *     {
   *       title: 'Approve Invoice',
   *       description: `Review invoice ${invoice.number} before sending`,
   *       assigneeRole: 'admin',
   *       context: { invoiceId: invoice.id, amount: invoice.total },
   *     },
   *   );
   */
  protected pause(
    outputs: Record<string, unknown>,
    payload: PausePayload,
  ): NodeExecuteResult {
    return { status: 'paused', outputs, pause: payload };
  }

  /**
   * Return a skipped result — runner continues to next node.
   * Use when a node is conditionally bypassed by business logic
   * (as opposed to canvas-level 'bypassed' mode).
   */
  protected skipped(reason?: string): NodeExecuteResult {
    return {
      status: 'skipped',
      outputs: {},
      summary: reason ?? 'Node skipped',
    };
  }

  /**
   * Convenience: clean up resources (DB connections, temp files).
   * Called by the engine after execution regardless of outcome.
   * No-op by default — override if the node allocates resources.
   */
  destroy(): void {
    // no-op
  }
}
