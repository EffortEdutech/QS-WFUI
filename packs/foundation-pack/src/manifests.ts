/**
 * @lados/foundation-pack — NodeManifestV2 declarations (Phase 1F)
 */

import type { NodeManifestV2 } from '@lados/node-sdk';

// ── foundation.send_notification ─────────────────────────────────────────────

export const foundationSendNotificationManifest: NodeManifestV2 = {
  type:        'foundation.send_notification',
  name:        'Send Notification',
  version:     '1.0.0',
  description: 'Sends an in-app notification to a user from within a workflow.',
  category:    'notification',
  packId:      'foundation-pack',
  tags:        ['notification', 'user', 'message'],
  inputs: [
    { id: 'userId',    name: 'User ID',    dataType: 'string', required: true  },
    { id: 'title',     name: 'Title',      dataType: 'string', required: true  },
    { id: 'message',   name: 'Message',    dataType: 'string', required: false },
    { id: 'type',      name: 'Type',       dataType: 'string', required: false },
    { id: 'actionUrl', name: 'Action URL', dataType: 'string', required: false },
    { id: 'metadata',  name: 'Metadata',   dataType: 'object', required: false },
  ],
  outputs: [
    { id: 'notified',        name: 'Notified',         dataType: 'boolean' },
    { id: 'notificationId',  name: 'Notification ID',  dataType: 'string'  },
  ],
  config: [
    { key: 'userId',    label: 'User ID',    type: 'string',  required: false, description: 'Overridden by inputs.userId.' },
    { key: 'title',     label: 'Title',      type: 'string',  required: false },
    { key: 'message',   label: 'Message',    type: 'textarea', required: false },
    { key: 'type',      label: 'Type',       type: 'select',  required: false, defaultValue: 'system',
      options: [
        { value: 'system',           label: 'System' },
        { value: 'approval_request', label: 'Approval Request' },
        { value: 'execution_complete', label: 'Execution Complete' },
        { value: 'execution_failed',   label: 'Execution Failed' },
      ] },
    { key: 'actionUrl', label: 'Action URL', type: 'string',  required: false },
  ],
};

// ── foundation.request_approval ───────────────────────────────────────────────

export const foundationRequestApprovalManifest: NodeManifestV2 = {
  type:        'foundation.request_approval',
  name:        'Request Approval',
  version:     '1.0.0',
  description: 'Canonical human approval gate. Pauses execution; resumes only after a human with the required role approves or rejects. AI cannot resolve approval tasks.',
  category:    'core',
  packId:      'foundation-pack',
  tags:        ['approval', 'human', 'gate', 'pause'],
  inputs: [
    { id: 'title',        name: 'Title',         dataType: 'string',  required: true  },
    { id: 'description',  name: 'Description',   dataType: 'string',  required: false },
    { id: 'assigneeRole', name: 'Assignee Role', dataType: 'string',  required: false },
    { id: 'notifyUserId', name: 'Notify User ID', dataType: 'string', required: false },
    { id: 'data',         name: 'Data',          dataType: 'object',  required: false },
  ],
  outputs: [
    { id: 'approvalTaskId', name: 'Approval Task ID', dataType: 'string'  },
    { id: 'assigneeRole',   name: 'Assignee Role',    dataType: 'string'  },
    { id: 'pending',        name: 'Pending',          dataType: 'boolean' },
  ],
  config: [
    { key: 'title',        label: 'Title',         type: 'string',  required: true  },
    { key: 'description',  label: 'Description',   type: 'textarea', required: false },
    { key: 'assigneeRole', label: 'Assignee Role', type: 'select',  required: false, defaultValue: 'owner',
      options: [{ value: 'owner', label: 'Owner' }, { value: 'admin', label: 'Admin' }] },
  ],
};

// ── foundation.assign_user ────────────────────────────────────────────────────

export const foundationAssignUserManifest: NodeManifestV2 = {
  type:        'foundation.assign_user',
  name:        'Assign User',
  version:     '1.0.0',
  description: 'Assigns a user to a resource, writing assignee and assigneeRole into resource data.',
  category:    'resource',
  packId:      'foundation-pack',
  tags:        ['assign', 'user', 'resource'],
  inputs: [
    { id: 'resourceId',   name: 'Resource ID',   dataType: 'string', required: true  },
    { id: 'userId',       name: 'User ID',       dataType: 'string', required: true  },
    { id: 'assigneeRole', name: 'Assignee Role', dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'assigned',   name: 'Assigned',   dataType: 'boolean' },
    { id: 'resourceId', name: 'Resource ID', dataType: 'string' },
    { id: 'userId',     name: 'User ID',    dataType: 'string'  },
  ],
  config: [
    { key: 'resourceId',   label: 'Resource ID',   type: 'string', required: false },
    { key: 'userId',       label: 'User ID',       type: 'string', required: false },
    { key: 'assigneeRole', label: 'Assignee Role', type: 'string', required: false, description: 'Role label e.g. driver, reviewer, owner' },
  ],
  resourceRequirements: [{ type: 'any', access: 'write', description: 'Updates resource data.assignee field.' }],
};

// ── Collected manifest array ──────────────────────────────────────────────────

export const nodeManifests: NodeManifestV2[] = [
  foundationSendNotificationManifest,
  foundationRequestApprovalManifest,
  foundationAssignUserManifest,
];
