/**
 * Foundation Pack — Type Catalogue
 *
 * Canonical resource type names and event type names for the Foundation layer.
 * Other packs depend on these constants instead of hardcoding strings.
 *
 * Resource types listed here are the "universal" objects that exist in every
 * Lados workspace. Domain-specific types (trip, invoice, etc.) live in their
 * respective solution packs.
 */

// ── Foundation resource types ─────────────────────────────────────────────────

export const FOUNDATION_RESOURCE_TYPES = [
  'user',
  'role',
  'permission',
  'team',
  'file',
  'attachment',
  'comment',
  'notification',
  'approval',
  'audit_log',
  'tag',
] as const;

export type FoundationResourceType = typeof FOUNDATION_RESOURCE_TYPES[number];

// ── Foundation event types ────────────────────────────────────────────────────

export const FOUNDATION_EVENTS = {
  // User lifecycle
  USER_CREATED:           'user.created',
  USER_UPDATED:           'user.updated',
  USER_DEACTIVATED:       'user.deactivated',

  // File / attachment
  FILE_UPLOADED:          'file.uploaded',
  FILE_DELETED:           'file.deleted',
  ATTACHMENT_ADDED:       'attachment.added',

  // Approval lifecycle
  APPROVAL_REQUESTED:     'approval.requested',
  APPROVAL_GRANTED:       'approval.granted',
  APPROVAL_REJECTED:      'approval.rejected',

  // Notification
  NOTIFICATION_SENT:      'notification.sent',

  // Comment / Tag
  COMMENT_ADDED:          'comment.added',
  TAG_ADDED:              'tag.added',
  TAG_REMOVED:            'tag.removed',

  // Assignment
  USER_ASSIGNED:          'user.assigned',
  USER_UNASSIGNED:        'user.unassigned',
} as const;

export type FoundationEventType = typeof FOUNDATION_EVENTS[keyof typeof FOUNDATION_EVENTS];

// ── Shared notification type mirror ──────────────────────────────────────────
//
// Kept in sync with apps/api/src/notification/notification.service.ts manually.
// Packs cannot import NestJS services, so the type is duplicated here.

export type NotificationType =
  | 'approval_request'
  | 'execution_complete'
  | 'execution_failed'
  | 'data_pack_update'
  | 'quota_warning'
  | 'system';
