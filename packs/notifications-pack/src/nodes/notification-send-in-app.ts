/**
 * notification.send_in_app
 *
 * Sends an in-app notification to a specific user via the injected
 * IInAppNotificationService (backed by NotificationService in the API).
 * The notification appears in the user's notification bell in the UI.
 *
 * This is the notifications-pack canonical node. For legacy compat,
 * foundation.send_notification also delivers in-app notifications —
 * both call the same underlying NotificationService.
 *
 * Inputs:
 *   userId     — target user ID (required)
 *   title      — notification title (required)
 *   message    — body text (optional)
 *   type       — NotificationType (default: 'system')
 *   actionUrl  — deep-link URL to open on click (optional)
 *   metadata   — extra key-value payload (optional)
 *
 * Outputs:
 *   notified        — boolean
 *   notificationId  — created notification ID or null
 *   userId          — target user
 *
 * Phase 10
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { IInAppNotificationService, NotificationType } from '../types';

export async function realSendInApp(
  ctx: NodeContext,
  notificationService?: IInAppNotificationService,
): Promise<NodeExecuteResult> {
  if (!notificationService) {
    return {
      status: 'failure',
      outputs: { notified: false, notificationId: null, userId: null },
      error: { code: 'NO_SERVICE', message: 'NotificationService not injected' },
    };
  }

  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const userId    = (inp['userId']    ?? cfg['userId'])    as string | undefined;
  const title     = (inp['title']     ?? cfg['title'])     as string | undefined;
  const message   = (inp['message']   ?? cfg['message'])   as string | undefined;
  const type      = ((inp['type']     ?? cfg['type'])      as NotificationType | undefined) ?? 'system';
  const actionUrl = (inp['actionUrl'] ?? cfg['actionUrl']) as string | undefined;
  const metadata  = (inp['metadata']  ?? cfg['metadata'])  as Record<string, unknown> | undefined;

  if (!userId) {
    return {
      status: 'failure',
      outputs: { notified: false, notificationId: null, userId: null },
      error: { code: 'MISSING_INPUT', message: 'notification.send_in_app: userId is required' },
    };
  }
  if (!title) {
    return {
      status: 'failure',
      outputs: { notified: false, notificationId: null, userId },
      error: { code: 'MISSING_INPUT', message: 'notification.send_in_app: title is required' },
    };
  }

  ctx.logger.info(
    `notification.send_in_app → user:${userId} type:${type} title:"${title}"`,
  );

  try {
    const notificationId = await notificationService.notify({
      userId,
      orgId:     ctx.organizationId,
      type,
      title,
      body:      message,
      actionUrl,
      metadata: {
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
        userId,
      },
      summary: `In-app notification sent to user ${userId}: "${title}"`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.logger.error(`notification.send_in_app failed: ${msg}`);
    return {
      status: 'failure',
      outputs: { notified: false, notificationId: null, userId },
      error: { code: 'NOTIFICATION_FAILED', message: msg },
    };
  }
}
