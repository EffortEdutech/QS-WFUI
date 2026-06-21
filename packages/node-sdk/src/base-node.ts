/**
 * @lados/node-sdk — BaseNode abstract class
 * Sprint 5 (S5-001)
 *
 * All concrete nodes extend BaseNode and implement:
 *   - getManifest() → NodeManifest
 *   - execute(ctx)  → Promise<NodeExecuteResult>
 *
 * validate() has a default implementation that checks required config fields.
 */

import type {
  NodeManifest,
  NodeContext,
  NodeExecuteResult,
  NodeValidationResult,
  ValidationIssue,
} from './types';

export abstract class BaseNode {
  /** Return the static manifest for this node type */
  abstract getManifest(): NodeManifest;

  /** Execute the node with the given context */
  abstract execute(ctx: NodeContext): Promise<NodeExecuteResult>;

  /**
   * Validate config before execution.
   * Default: checks required fields are present and non-empty.
   * Override for custom business-rule validation.
   */
  validate(ctx: NodeContext): NodeValidationResult {
    const manifest = this.getManifest();
    const issues: ValidationIssue[] = [];

    for (const field of manifest.configSchema) {
      if (field.required) {
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

  /** Called by engine after successful execution (override if needed) */
  onSuccess(_ctx: NodeContext, _result: NodeExecuteResult): void {
    // no-op by default
  }

  /** Called by engine after a failed execution (override if needed) */
  onFailure(_ctx: NodeContext, _error: unknown): void {
    // no-op by default
  }

  /** Cleanup resources (files, connections) after execution */
  destroy(): void {
    // no-op by default
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  protected success(
    outputs: Record<string, unknown>,
    summary?: string,
  ): NodeExecuteResult {
    return { status: 'success', outputs, summary };
  }

  protected failure(
    code: string,
    message: string,
    details?: unknown,
  ): NodeExecuteResult {
    return {
      status: 'failure',
      outputs: {},
      error: { code, message, details },
    };
  }

  protected pendingApproval(
    outputs: Record<string, unknown>,
    request: { title: string; description: string; assigneeRole?: string },
  ): NodeExecuteResult {
    return {
      status: 'pending_approval',
      outputs,
      approvalRequest: request,
    };
  }
}
