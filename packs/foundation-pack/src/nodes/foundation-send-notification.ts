/**
 * foundation.send_notification
 *
 * Send an in-app notification to a user from within a workflow.
 *
 * Inputs (from node inputs or config):
 *   userId     — target user ID (required)
 *   title      — notification title (required)
 *   message    — notification body text (optional)
 *   type       — notification type (default: 'system')
 *   actionUrl  — deep-link URL in the app (optional)
 *   metadata   — arbitrary key-value payload (optional)
 *
 * Outputs:
 *   notified         — boolean
 *   notificationId   — string | null
 *
 * Phase 7: moves NotificationModule capability into Foundation Pack as a
 * proper workflow node rather than an imperative service call.
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { NotificationType } from '../types';

// ── Service interface ─────────────────────────────────────────────────────────

/** Minimal interface — NestJS NotificationService satisfies this via duck typing. */
export interface INotificationService {
  notify(payload: {
    userId: string;
    orgId?: string;
    type: NotificationType;
    title: string;
    body?: string;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string | null>;
}

// ── Node implementation ───────────────────────────────────────────────────────

export async function realSendNotification(
  ctx: NodeContext,
  notificationService?: INotificationService,
): Promise<NodeExecuteResult> {
  if (!notificationService) {
    return {
      status: 'failure',
      outputs: { notified: false, notificationId: null },
      error: { code: 'NO_SERVICE', message: 'NotificationService not injected' },
    };
  }

  // Resolve inputs — prefer dynamic inputs over static config
  const userId    = (ctx.inputs['userId']    ?? ctx.config['userId'])    as string | undefined;
  const title     = (ctx.inputs['title']     ?? ctx.config['title'])     as string | undefined;
  const message   = (ctx.inputs['message']   ?? ctx.config['message'])   as string | undefined;
  const type      = (ctx.inputs['type']      ?? ctx.config['type'] ?? 'system') as NotificationType;
  const actionUrl = (ctx.inputs['actionUrl'] ?? ctx.config['actionUrl']) as string | undefined;
  const metadata  = (ctx.inputs['metadata']  ?? ctx.config['metadata'])  as Record<string, unknown> | undefined;

  if (!userId) {
    return {
      status: 'failure',
      outputs: { notified: false, notificationId: null },
      error: { code: 'MISSING_INPUT', message: 'userId is required' },
    };
  }

  if (!title) {
    return {
      status: 'failure',
      outputs: { notified: false, notificationId: null },
      error: { code: 'MISSING_INPUT', message: 'title is required' },
    };
  }

  ctx.logger.info(`foundation.send_notification → user:${userId} type:${type} title:"${title}"`);

  try {
    const notificationId = await notificationService.notify({
      userId,
      orgId:     ctx.organizationId,
      type,
      title,
      body:      message,
      actionUrl,
      metadata:  {
        workflowId:  ctx.workflowId,
        executionId: ctx.executionId,
        ...(metadata ?? {}),
      },
    });

    return {
      status: 'success',
      outputs: {
        notified:       true,
        notificationId: notificationId ?? null,
      },
    };
  } catch (err) {
    const message_ = err instanceof Error ? err.message : String(err);
    ctx.logger.error(`foundation.send_notification failed: ${message_}`);
    return {
      status: 'failure',
      outputs: { notified: false, notificationId: null },
      error: { code: 'NOTIFICATION_FAILED', message: message_ },
    };
  }
}
