/**
 * @lados/notifications-pack
 *
 * Notification channel nodes for Lados workflows.
 * Three channels: email (SMTP), SMS (stub), in-app (NotificationService).
 *
 * Phase 10
 */

import type { PackManifest } from '@lados/pack-sdk';
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

import { realSendEmail }  from './nodes/notification-send-email';
import { realSendSms }    from './nodes/notification-send-sms';
import { realSendInApp }  from './nodes/notification-send-in-app';

// ── Re-export types ───────────────────────────────────────────────────────────

export {
  type NotificationType,
  type EmailPayload,
  type EmailResult,
  type IEmailService,
  type SmsPayload,
  type SmsResult,
  type ISmsService,
  type InAppPayload,
  type InAppResult,
  type IInAppNotificationService,
} from './types';

export { nodeManifests } from './manifests';

export const PACK_ID      = 'notifications-pack' as const;
export const PACK_VERSION = '0.1.0' as const;

export const manifest: PackManifest = {
  id:          PACK_ID,
  version:     PACK_VERSION,
  displayName: 'Notifications Pack',
  description: 'Notification channel nodes — send email (SMTP), SMS, and in-app notifications from any workflow.',
  author:      'Lados Platform',
  nodes: [
    'notification.send_email',
    'notification.send_sms',
    'notification.send_in_app',
  ],
};

export interface NotificationsPackServices {
  emailService?:        import('./types').IEmailService;
  smsService?:          import('./types').ISmsService;
  notificationService?: import('./types').IInAppNotificationService;
}

type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;

const noService = (code: string, msg: string): NodeExecuteResult =>
  ({ status: 'failure', outputs: {}, error: { code, message: msg } });

/**
 * Returns the real executor for a notifications-pack node type, or null if unknown.
 */
export function resolveNode(
  services: NotificationsPackServices = {},
): (nodeType: string) => NodeExecutor | null {
  const { emailService, smsService, notificationService } = services;

  const nodes: Record<string, NodeExecutor> = {
    'notification.send_email':
      (ctx) => emailService
        ? realSendEmail(ctx, emailService)
        : Promise.resolve(noService('NO_SERVICE', 'EmailService not injected — configure SMTP_HOST env var')),

    'notification.send_sms':
      (ctx) => smsService
        ? realSendSms(ctx, smsService)
        : Promise.resolve(noService('NO_SERVICE', 'SmsService not injected — configure SMS_PROVIDER env var')),

    'notification.send_in_app':
      (ctx) => notificationService
        ? realSendInApp(ctx, notificationService)
        : Promise.resolve(noService('NO_SERVICE', 'NotificationService not injected')),
  };

  return (nodeType: string) => nodes[nodeType] ?? null;
}
