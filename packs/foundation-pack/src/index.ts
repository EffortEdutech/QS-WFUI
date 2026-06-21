/**
 * @lados/foundation-pack
 *
 * The mandatory base pack — universal capabilities every Lados workspace needs.
 *
 * Phase 7: initial implementation
 *   foundation.send_notification  — notify a user from within a workflow
 *   foundation.request_approval   — canonical human approval gate (replaces core.human_approval)
 *   foundation.assign_user        — assign a user to a resource
 *
 * Future (Phase 9+):
 *   foundation.upload_file        — store a file and attach it to a resource
 *   foundation.add_comment        — attach a comment to any resource
 *   foundation.add_tag            — tag a resource
 *   foundation.archive_resource   — soft-delete / archive a resource
 *
 * AI guardrail (non-negotiable):
 *   foundation.request_approval pause nodes may ONLY be resolved by a human with
 *   owner|admin role. The SecurityEngine enforces this at the /approvals/:id/decide
 *   endpoint. AI output must never be treated as an approval decision.
 */

import type { PackManifest } from '@lados/pack-sdk';
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

import { realSendNotification } from './nodes/foundation-send-notification';
import { realRequestApproval }  from './nodes/foundation-request-approval';
import { realAssignUser }       from './nodes/foundation-assign-user';

// ── Re-export service interfaces so the API layer can implement them ───────────

export { type INotificationService }    from './nodes/foundation-send-notification';
export { type IApprovalTaskService }    from './nodes/foundation-request-approval';
export { type IAssignableResourceService } from './nodes/foundation-assign-user';

// ── Re-export type catalogue ──────────────────────────────────────────────────

export {
  FOUNDATION_RESOURCE_TYPES,
  FOUNDATION_EVENTS,
  type FoundationResourceType,
  type FoundationEventType,
  type NotificationType,
} from './types';

// ── Pack identity ─────────────────────────────────────────────────────────────

export const PACK_ID      = 'foundation-pack' as const;
export const PACK_VERSION = '0.1.0' as const;

export const manifest: PackManifest = {
  id:          PACK_ID,
  version:     PACK_VERSION,
  displayName: 'Foundation Pack',
  description: 'Universal capabilities: notifications, approval gates, user assignment. Mandatory base pack for all Lados workspaces.',
  author:      'Lados Platform',
  nodes: [
    'foundation.send_notification',
    'foundation.request_approval',
    'foundation.assign_user',
  ],
};

// ── Service bag ───────────────────────────────────────────────────────────────

export interface FoundationPackServices {
  notificationService?: import('./nodes/foundation-send-notification').INotificationService;
  approvalTaskService?: import('./nodes/foundation-request-approval').IApprovalTaskService;
  resourceService?:     import('./nodes/foundation-assign-user').IAssignableResourceService;
}

// ── Node resolver ─────────────────────────────────────────────────────────────

type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;

const NO_SERVICE = (code: string, message: string): NodeExecuteResult => ({
  status:  'failure',
  outputs: {},
  error:   { code, message },
});

/**
 * Returns the real executor for a foundation-pack node type, or null if unknown.
 * Call once in buildRealNodeResolver, injecting NestJS services.
 */
export function resolveNode(
  services: FoundationPackServices = {},
): (nodeType: string) => NodeExecutor | null {
  const { notificationService, approvalTaskService, resourceService } = services;

  const nodes: Record<string, NodeExecutor> = {
    'foundation.send_notification': (ctx) =>
      notificationService
        ? realSendNotification(ctx, notificationService)
        : Promise.resolve(NO_SERVICE('NO_SERVICE', 'NotificationService not injected')),

    'foundation.request_approval': (ctx) =>
      approvalTaskService
        ? realRequestApproval(ctx, approvalTaskService, notificationService)
        : Promise.resolve(NO_SERVICE('NO_SERVICE', 'ApprovalTaskService not injected')),

    'foundation.assign_user': (ctx) =>
      resourceService
        ? realAssignUser(ctx, resourceService)
        : Promise.resolve(NO_SERVICE('NO_SERVICE', 'ResourceService not injected')),
  };

  return (nodeType: string) => nodes[nodeType] ?? null;
}
