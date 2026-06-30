/**
 * @lados/notifications-pack — NodeManifestV2 declarations (Phase 10)
 */

import type { NodeManifestV2 } from '@lados/node-sdk';

// ── notification.send_email ───────────────────────────────────────────────────

export const notificationSendEmailManifest: NodeManifestV2 = {
  type:        'notification.send_email',
  name:        'Send Email',
  version:     '1.0.0',
  description: 'Sends an email to one or more recipients via SMTP. Requires SMTP_HOST to be configured on the server.',
  category:    'notification',
  packId:      'notifications-pack',
  tags:        ['email', 'notification', 'smtp', 'communication'],
  inputs: [
    { id: 'to',      name: 'To (recipient)',  dataType: 'string', required: true,
      description: 'Recipient email address(es), comma-separated.' },
    { id: 'subject', name: 'Subject',         dataType: 'string', required: true  },
    { id: 'body',    name: 'Body (text)',      dataType: 'string', required: false,
      description: 'Plain-text body. Required if html not provided.' },
    { id: 'html',    name: 'Body (HTML)',      dataType: 'string', required: false },
    { id: 'from',    name: 'From (override)',  dataType: 'string', required: false },
    { id: 'replyTo', name: 'Reply-To',         dataType: 'string', required: false },
    { id: 'cc',      name: 'CC',               dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'sent',       name: 'Sent',        dataType: 'boolean' },
    { id: 'messageId',  name: 'Message ID',  dataType: 'string'  },
    { id: 'recipients', name: 'Recipients',  dataType: 'array'   },
  ],
  config: [
    { key: 'to',      label: 'To',      type: 'string', required: false,
      description: 'Default recipient(s). Overridden by input if connected.' },
    { key: 'subject', label: 'Subject', type: 'string', required: false },
    { key: 'body',    label: 'Body',    type: 'textarea', required: false },
  ],
};

// ── notification.send_sms ─────────────────────────────────────────────────────

export const notificationSendSmsManifest: NodeManifestV2 = {
  type:        'notification.send_sms',
  name:        'Send SMS',
  version:     '1.0.0',
  description: 'Sends an SMS to a phone number. Phase 10: log stub — configure SMS_PROVIDER env vars to enable real delivery (Twilio, MSG91).',
  category:    'notification',
  packId:      'notifications-pack',
  tags:        ['sms', 'notification', 'communication', 'mobile'],
  inputs: [
    { id: 'to',      name: 'To (phone)',  dataType: 'string', required: true,
      description: 'E.164 phone number e.g. +60123456789' },
    { id: 'message', name: 'Message',    dataType: 'string', required: true,
      description: 'SMS text body (≤160 chars per segment).' },
    { id: 'from',    name: 'Sender ID',  dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'sent',      name: 'Sent',       dataType: 'boolean' },
    { id: 'messageId', name: 'Message ID', dataType: 'string'  },
    { id: 'to',        name: 'Recipient',  dataType: 'string'  },
  ],
  config: [
    { key: 'to',      label: 'To',      type: 'string', required: false },
    { key: 'message', label: 'Message', type: 'textarea', required: false },
  ],
};

// ── notification.send_in_app ──────────────────────────────────────────────────

export const notificationSendInAppManifest: NodeManifestV2 = {
  type:        'notification.send_in_app',
  name:        'Send In-App Notification',
  version:     '1.0.0',
  description: 'Creates an in-app notification for a user. Appears in the notification bell in the Lados UI. Backed by the notifications table.',
  category:    'notification',
  packId:      'notifications-pack',
  tags:        ['in-app', 'notification', 'alert', 'user'],
  inputs: [
    { id: 'userId',    name: 'User ID',    dataType: 'string', required: true  },
    { id: 'title',     name: 'Title',      dataType: 'string', required: true  },
    { id: 'message',   name: 'Message',    dataType: 'string', required: false },
    { id: 'type',      name: 'Type',       dataType: 'string', required: false },
    { id: 'actionUrl', name: 'Action URL', dataType: 'string', required: false,
      description: 'Deep-link URL opened when the user clicks the notification.' },
    { id: 'metadata',  name: 'Metadata',   dataType: 'object', required: false },
  ],
  outputs: [
    { id: 'notified',        name: 'Notified',        dataType: 'boolean' },
    { id: 'notificationId',  name: 'Notification ID', dataType: 'string'  },
    { id: 'userId',          name: 'User ID',         dataType: 'string'  },
  ],
  config: [
    { key: 'userId',    label: 'User ID',    type: 'string',   required: false },
    { key: 'title',     label: 'Title',      type: 'string',   required: false },
    { key: 'message',   label: 'Message',    type: 'textarea', required: false },
    { key: 'type',      label: 'Type',       type: 'select',   required: false, defaultValue: 'system',
      options: [
        { value: 'system',           label: 'System' },
        { value: 'approval_request', label: 'Approval Request' },
        { value: 'execution_complete', label: 'Execution Complete' },
        { value: 'execution_failed',   label: 'Execution Failed' },
        { value: 'quota_warning',      label: 'Quota Warning' },
      ],
    },
    { key: 'actionUrl', label: 'Action URL', type: 'string',   required: false },
  ],
};

// ── Aggregated export ─────────────────────────────────────────────────────────

export const nodeManifests: NodeManifestV2[] = [
  notificationSendEmailManifest,
  notificationSendSmsManifest,
  notificationSendInAppManifest,
];
