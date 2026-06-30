/**
 * @lados/core-pack — NodeManifestV2 declarations (Phase 1F)
 *
 * One manifest per node type. The Node Registry API (Phase 1H) reads these
 * to populate `registered_nodes` in the database.
 */

import type { NodeManifestV2 } from '@lados/node-sdk';

// ── core.logger ───────────────────────────────────────────────────────────────

export const coreLoggerManifest: NodeManifestV2 = {
  type:        'core.logger',
  name:        'Logger',
  version:     '1.0.0',
  description: 'Logs a message and optional data snapshot to the execution log.',
  category:    'core',
  packId:      'core-pack',
  tags:        ['log', 'debug', 'utility'],
  inputs:  [],
  outputs: [
    { id: 'logged',     name: 'Logged',     dataType: 'boolean' },
    { id: 'message',    name: 'Message',    dataType: 'string'  },
    { id: 'level',      name: 'Level',      dataType: 'string'  },
    { id: 'logged_at',  name: 'Logged At',  dataType: 'string'  },
  ],
  config: [
    { key: 'message', label: 'Message',   type: 'string',  required: true,  defaultValue: 'Checkpoint reached', description: 'Message to log.' },
    { key: 'level',   label: 'Log Level', type: 'select',  required: false, defaultValue: 'info',
      options: [{ value: 'info', label: 'Info' }, { value: 'warn', label: 'Warn' }, { value: 'error', label: 'Error' }] },
  ],
};

// ── core.cron_trigger ─────────────────────────────────────────────────────────

export const coreCronTriggerManifest: NodeManifestV2 = {
  type:        'core.cron_trigger',
  name:        'Cron Trigger',
  version:     '1.0.0',
  description: 'Fires on a cron schedule. In manual runs, triggers immediately.',
  category:    'scheduler',
  packId:      'core-pack',
  tags:        ['trigger', 'schedule', 'cron'],
  inputs:  [],
  outputs: [
    { id: 'triggered_at',    name: 'Triggered At',    dataType: 'string' },
    { id: 'cron_expression', name: 'Cron Expression', dataType: 'string' },
    { id: 'timezone',        name: 'Timezone',        dataType: 'string' },
  ],
  config: [
    { key: 'cron_expression', label: 'Cron Expression', type: 'string',  required: true,  description: 'Standard 5-part cron expression (e.g. 0 8 * * 1-5).' },
    { key: 'timezone',        label: 'Timezone',        type: 'string',  required: false, defaultValue: 'Asia/Kuala_Lumpur' },
    { key: 'description',     label: 'Description',     type: 'string',  required: false },
  ],
};

// ── core.human_approval ───────────────────────────────────────────────────────

export const coreHumanApprovalManifest: NodeManifestV2 = {
  type:        'core.human_approval',
  name:        'Human Approval',
  version:     '1.0.0',
  description: 'Pauses workflow execution until a human with the required role approves or rejects. AI cannot resolve approval tasks.',
  category:    'core',
  packId:      'core-pack',
  tags:        ['approval', 'human', 'gate', 'pause'],
  inputs:  [],
  outputs: [
    { id: 'approvalTaskId', name: 'Approval Task ID', dataType: 'string'  },
    { id: 'assigneeRole',   name: 'Assignee Role',    dataType: 'string'  },
    { id: 'pending',        name: 'Pending',          dataType: 'boolean' },
  ],
  config: [
    { key: 'title',         label: 'Title',         type: 'string',  required: true,  defaultValue: 'Approve Workflow Step' },
    { key: 'assignee_role', label: 'Assignee Role', type: 'select',  required: false, defaultValue: 'owner',
      options: [{ value: 'owner', label: 'Owner' }, { value: 'admin', label: 'Admin' }, { value: 'member', label: 'Member' }] },
    { key: 'description',   label: 'Description',   type: 'textarea', required: false },
  ],
};

// ── core.condition (formerly workflow.condition) ──────────────────────────────

export const workflowConditionManifest: NodeManifestV2 = {
  type:        'core.condition',
  name:        'Condition',
  version:     '1.0.0',
  description: 'Evaluates a data expression and routes to true_path or false_path.',
  category:    'core',
  packId:      'core-pack',
  tags:        ['condition', 'branch', 'routing', 'logic'],
  inputs: [
    { id: 'value', name: 'Value', dataType: 'any', required: true, description: 'The value to evaluate.' },
  ],
  outputs: [
    { id: 'result',     name: 'Result',     dataType: 'boolean' },
    { id: 'true_path',  name: 'True Path',  dataType: 'boolean' },
    { id: 'false_path', name: 'False Path', dataType: 'boolean' },
  ],
  config: [
    { key: 'expression', label: 'Expression', type: 'string', required: true, description: 'e.g. value >= 100, value == "approved", value != null' },
  ],
};

// ── artifact.write ────────────────────────────────────────────────────────────

export const artifactWriteManifest: NodeManifestV2 = {
  type:        'artifact.write',
  name:        'Write Artifact',
  version:     '1.0.0',
  description: 'Writes a named artifact to the project artifact store. Other workflows read it via artifact.read.',
  category:    'core',
  packId:      'core-pack',
  tags:        ['artifact', 'storage', 'persist'],
  inputs: [
    { id: 'value', name: 'Value', dataType: 'any',    required: true,  description: 'Data to store.' },
    { id: 'key',   name: 'Key',   dataType: 'string', required: false, description: 'Overrides config key at runtime.' },
  ],
  outputs: [
    { id: 'artifactId', name: 'Artifact ID', dataType: 'string' },
    { id: 'key',        name: 'Key',         dataType: 'string' },
    { id: 'version',    name: 'Version',     dataType: 'number' },
  ],
  config: [
    { key: 'key',  label: 'Artifact Key', type: 'string', required: true, description: 'Unique name within this project (e.g. current_job).' },
    { key: 'type', label: 'Type',         type: 'select', required: false, defaultValue: 'json',
      options: [{ value: 'json', label: 'JSON' }, { value: 'text', label: 'Text' }, { value: 'file', label: 'File' }] },
  ],
};

// ── artifact.read ─────────────────────────────────────────────────────────────

export const artifactReadManifest: NodeManifestV2 = {
  type:        'artifact.read',
  name:        'Read Artifact',
  version:     '1.0.0',
  description: 'Reads a named artifact from the project artifact store.',
  category:    'core',
  packId:      'core-pack',
  tags:        ['artifact', 'storage', 'read'],
  inputs: [
    { id: 'key', name: 'Key', dataType: 'string', required: false, description: 'Overrides config key at runtime.' },
  ],
  outputs: [
    { id: 'value',   name: 'Value',   dataType: 'any'     },
    { id: 'found',   name: 'Found',   dataType: 'boolean' },
    { id: 'version', name: 'Version', dataType: 'number'  },
    { id: 'key',     name: 'Key',     dataType: 'string'  },
  ],
  config: [
    { key: 'key',      label: 'Artifact Key', type: 'string',  required: true },
    { key: 'required', label: 'Required',     type: 'boolean', required: false, defaultValue: false, description: 'Fail if artifact not found.' },
  ],
};

// ── project.save_artifact (legacy) ────────────────────────────────────────────

export const projectSaveArtifactManifest: NodeManifestV2 = {
  type:        'project.save_artifact',
  name:        'Save Artifact (Legacy)',
  version:     '1.0.0',
  description: 'Legacy: saves node inputs to project_artifacts table. Use artifact.write for new workflows.',
  category:    'core',
  packId:      'core-pack',
  tags:        ['artifact', 'legacy'],
  inputs:  [{ id: 'data', name: 'Data', dataType: 'any' }],
  outputs: [
    { id: 'artifact_key', name: 'Artifact Key', dataType: 'string' },
    { id: 'saved_at',     name: 'Saved At',     dataType: 'string' },
  ],
  config: [
    { key: 'artifact_key',  label: 'Artifact Key',  type: 'string', required: true },
    { key: 'include_keys',  label: 'Include Keys',  type: 'json',   required: false, description: 'Array of input keys to save; defaults to all.' },
  ],
};

// ── project.read_artifact (legacy) ────────────────────────────────────────────

export const projectReadArtifactManifest: NodeManifestV2 = {
  type:        'project.read_artifact',
  name:        'Read Artifact (Legacy)',
  version:     '1.0.0',
  description: 'Legacy: reads a named artifact from project_artifacts. Use artifact.read for new workflows.',
  category:    'core',
  packId:      'core-pack',
  tags:        ['artifact', 'legacy'],
  inputs:  [],
  outputs: [
    { id: 'value',              name: 'Value',             dataType: 'any'    },
    { id: 'artifact_key',       name: 'Artifact Key',      dataType: 'string' },
    { id: 'source_workflow_id', name: 'Source Workflow ID', dataType: 'string' },
  ],
  config: [
    { key: 'artifact_key', label: 'Artifact Key', type: 'string', required: true },
  ],
};

// ── resource.create ───────────────────────────────────────────────────────────

export const resourceCreateManifest: NodeManifestV2 = {
  type:        'resource.create',
  name:        'Create Resource',
  version:     '1.0.0',
  description: 'Creates a new resource in the Resource Engine.',
  category:    'resource',
  packId:      'core-pack',
  tags:        ['resource', 'create'],
  inputs: [
    { id: 'type',      name: 'Type',       dataType: 'string' },
    { id: 'name',      name: 'Name',       dataType: 'string' },
    { id: 'data',      name: 'Data',       dataType: 'object' },
    { id: 'projectId', name: 'Project ID', dataType: 'string' },
    { id: 'parentId',  name: 'Parent ID',  dataType: 'string' },
  ],
  outputs: [
    { id: 'resourceId', name: 'Resource ID', dataType: 'string' },
    { id: 'state',      name: 'State',       dataType: 'string' },
    { id: 'type',       name: 'Type',        dataType: 'string' },
    { id: 'name',       name: 'Name',        dataType: 'string' },
  ],
  config: [
    { key: 'type', label: 'Resource Type', type: 'string', required: false, description: 'Overridden by inputs.type at runtime.' },
    { key: 'name', label: 'Name',          type: 'string', required: false },
  ],
  resourceRequirements: [{ type: 'any', access: 'create' }],
};

// ── resource.read ─────────────────────────────────────────────────────────────

export const resourceReadManifest: NodeManifestV2 = {
  type:        'resource.read',
  name:        'Read Resource',
  version:     '1.0.0',
  description: 'Fetches a resource by ID from the Resource Engine.',
  category:    'resource',
  packId:      'core-pack',
  tags:        ['resource', 'read'],
  inputs:  [{ id: 'resourceId', name: 'Resource ID', dataType: 'string', required: true }],
  outputs: [
    { id: 'resourceId', name: 'Resource ID', dataType: 'string' },
    { id: 'type',       name: 'Type',        dataType: 'string' },
    { id: 'name',       name: 'Name',        dataType: 'string' },
    { id: 'state',      name: 'State',       dataType: 'string' },
    { id: 'data',       name: 'Data',        dataType: 'object' },
  ],
  config: [],
  resourceRequirements: [{ type: 'any', access: 'read' }],
};

// ── resource.update ───────────────────────────────────────────────────────────

export const resourceUpdateManifest: NodeManifestV2 = {
  type:        'resource.update',
  name:        'Update Resource',
  version:     '1.0.0',
  description: 'Patches name and/or data on an existing resource.',
  category:    'resource',
  packId:      'core-pack',
  tags:        ['resource', 'update'],
  inputs: [
    { id: 'resourceId', name: 'Resource ID', dataType: 'string', required: true },
    { id: 'name',       name: 'Name',        dataType: 'string' },
    { id: 'data',       name: 'Data',        dataType: 'object' },
  ],
  outputs: [
    { id: 'resourceId', name: 'Resource ID', dataType: 'string' },
    { id: 'updated',    name: 'Updated',     dataType: 'boolean' },
  ],
  config: [],
  resourceRequirements: [{ type: 'any', access: 'write' }],
};

// ── resource.transition ───────────────────────────────────────────────────────

export const resourceTransitionManifest: NodeManifestV2 = {
  type:        'resource.transition',
  name:        'Transition Resource',
  version:     '1.0.0',
  description: 'Advances a resource through its state machine to the given target state.',
  category:    'resource',
  packId:      'core-pack',
  tags:        ['resource', 'state', 'transition'],
  inputs: [
    { id: 'resourceId', name: 'Resource ID', dataType: 'string', required: true  },
    { id: 'toState',    name: 'To State',    dataType: 'string', required: true  },
    { id: 'actorRole',  name: 'Actor Role',  dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'resourceId', name: 'Resource ID', dataType: 'string'  },
    { id: 'fromState',  name: 'From State',  dataType: 'string'  },
    { id: 'toState',    name: 'To State',    dataType: 'string'  },
    { id: 'transitioned', name: 'Transitioned', dataType: 'boolean' },
  ],
  config: [],
  resourceRequirements: [{ type: 'any', access: 'write' }],
};

// ── resource.list ─────────────────────────────────────────────────────────────

export const resourceListManifest: NodeManifestV2 = {
  type:        'resource.list',
  name:        'List Resources',
  version:     '1.0.0',
  description: 'Queries resources by type, state, and/or project.',
  category:    'resource',
  packId:      'core-pack',
  tags:        ['resource', 'list', 'query'],
  inputs: [
    { id: 'type',      name: 'Type',       dataType: 'string' },
    { id: 'state',     name: 'State',      dataType: 'string' },
    { id: 'projectId', name: 'Project ID', dataType: 'string' },
  ],
  outputs: [
    { id: 'resources', name: 'Resources', dataType: 'array' },
    { id: 'count',     name: 'Count',     dataType: 'number' },
  ],
  config: [
    { key: 'type',  label: 'Resource Type', type: 'string', required: false },
    { key: 'state', label: 'State Filter',  type: 'string', required: false },
  ],
  resourceRequirements: [{ type: 'any', access: 'read' }],
};

// ── event.publish ─────────────────────────────────────────────────────────────

export const eventPublishManifest: NodeManifestV2 = {
  type:        'event.publish',
  name:        'Publish Event',
  version:     '1.0.0',
  description: 'Emits a domain event to the Event Bus. Events trigger subscribed workflows. AI guardrail: events cannot approve or certify commercial facts.',
  category:    'event',
  packId:      'core-pack',
  tags:        ['event', 'publish', 'bus'],
  inputs: [
    { id: 'eventType', name: 'Event Type', dataType: 'string', required: true  },
    { id: 'payload',   name: 'Payload',    dataType: 'object', required: false },
    { id: 'sourceId',  name: 'Source ID',  dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'eventId',   name: 'Event ID',  dataType: 'string'  },
    { id: 'published', name: 'Published', dataType: 'boolean' },
  ],
  config: [],
};

// ── state.change ──────────────────────────────────────────────────────────────

export const stateChangeManifest: NodeManifestV2 = {
  type:        'state.change',
  name:        'State Change',
  version:     '1.0.0',
  description: 'Transitions a resource to a new state, enforcing transition guards. May pause for human approval.',
  category:    'resource',
  packId:      'core-pack',
  tags:        ['state', 'transition', 'resource'],
  inputs: [
    { id: 'resourceId', name: 'Resource ID', dataType: 'string', required: true  },
    { id: 'toState',    name: 'To State',    dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'transitioned',     name: 'Transitioned',      dataType: 'boolean' },
    { id: 'newState',         name: 'New State',          dataType: 'string'  },
    { id: 'approvalTaskId',   name: 'Approval Task ID',   dataType: 'string'  },
    { id: 'approvalRequired', name: 'Approval Required',  dataType: 'boolean' },
  ],
  config: [
    { key: 'resourceId',    label: 'Resource ID',    type: 'string',  required: false, description: 'Overridden by inputs.resourceId.' },
    { key: 'toState',       label: 'Target State',   type: 'string',  required: false },
    { key: 'approvalTitle', label: 'Approval Title', type: 'string',  required: false },
  ],
  resourceRequirements: [{ type: 'any', access: 'write', description: 'Transitions the resource state.' }],
};

// ── core.loop ────────────────────────────────────────────────────────────────

export const coreLoopManifest: NodeManifestV2 = {
  type:        'core.loop',
  name:        'Loop',
  version:     '1.0.0',
  description: 'Iterates over an array of items and collects results. ' +
               'Use items_key to specify which upstream output contains the array.',
  category:    'core',
  packId:      'core-pack',
  tags:        ['loop', 'iterate', 'array', 'collect'],
  inputs:  [
    { id: 'items', name: 'Items', dataType: 'array', required: false,
      description: 'Array to iterate. Override with items_key config if the array lives under a different key.' },
  ],
  outputs: [
    { id: 'results',  name: 'Results',  dataType: 'array',   description: 'Processed items array.' },
    { id: 'count',    name: 'Count',    dataType: 'number',  description: 'Number of items.' },
    { id: 'first',    name: 'First',    dataType: 'any',     description: 'First result, or null.' },
    { id: 'last',     name: 'Last',     dataType: 'any',     description: 'Last result, or null.' },
  ],
  config: [
    { key: 'items_key',   label: 'Items Key',    type: 'string', required: false, defaultValue: 'items',
      description: 'Upstream output key containing the array (default: "items").' },
    { key: 'extract_key', label: 'Extract Key',  type: 'string', required: false,
      description: 'If set, map each item to item[extract_key].' },
    { key: 'label',       label: 'Label',        type: 'string', required: false,
      description: 'Human-readable label shown in logs.' },
  ],
};

// ── core.parallel ────────────────────────────────────────────────────────────

export const coreParallelManifest: NodeManifestV2 = {
  type:        'core.parallel',
  name:        'Parallel Split',
  version:     '1.0.0',
  description: 'Marks the start of parallel branches. Connect multiple downstream nodes ' +
               'to run them concurrently. Pair with core.merge.',
  category:    'core',
  packId:      'core-pack',
  tags:        ['parallel', 'split', 'concurrent', 'fan-out'],
  inputs:  [],
  outputs: [
    { id: 'parallel_start', name: 'Parallel Start', dataType: 'boolean' },
    { id: 'branch_count',   name: 'Branch Count',   dataType: 'number'  },
    { id: 'inputs',         name: 'Inputs',         dataType: 'object'  },
    { id: 'started_at',     name: 'Started At',     dataType: 'string'  },
  ],
  config: [
    { key: 'branch_count', label: 'Expected Branches', type: 'number', required: false, defaultValue: 2,
      description: 'Informational: expected number of parallel branches.' },
    { key: 'label',        label: 'Label',             type: 'string', required: false },
  ],
};

// ── core.merge ───────────────────────────────────────────────────────────────

export const coreMergeManifest: NodeManifestV2 = {
  type:        'core.merge',
  name:        'Merge Branches',
  version:     '1.0.0',
  description: 'Waits for all parallel branches and merges their outputs into a single object. ' +
               'Pair with core.parallel.',
  category:    'core',
  packId:      'core-pack',
  tags:        ['merge', 'join', 'fan-in', 'parallel'],
  inputs:  [],
  outputs: [
    { id: 'merged',       name: 'Merged',        dataType: 'object', description: 'Flat merged outputs from all branches.' },
    { id: 'branches',     name: 'Branches',      dataType: 'object', description: '{ [nodeId]: outputs } map.' },
    { id: 'branch_count', name: 'Branch Count',  dataType: 'number' },
    { id: 'completed_at', name: 'Completed At',  dataType: 'string' },
  ],
  config: [
    { key: 'merge_strategy', label: 'Merge Strategy', type: 'select', required: false, defaultValue: 'shallow',
      options: [
        { value: 'shallow', label: 'Shallow (last wins)' },
        { value: 'deep',    label: 'Deep (preserve nested keys)' },
      ],
    },
    { key: 'label', label: 'Label', type: 'string', required: false },
  ],
};

// ── core.delay ────────────────────────────────────────────────────────────────

export const coreDelayManifest: NodeManifestV2 = {
  type:        'core.delay',
  name:        'Delay',
  version:     '1.0.0',
  description: 'Pauses execution for a specified number of milliseconds (max 5 minutes). For longer waits use a scheduled trigger or human approval gate.',
  category:    'scheduler',
  packId:      'core-pack',
  tags:        ['delay', 'wait', 'sleep', 'scheduler', 'timing'],
  inputs: [
    { id: 'delay_ms', name: 'Delay (ms)', dataType: 'number', required: false,
      description: 'Milliseconds to wait. Overrides config when provided.' },
  ],
  outputs: [
    { id: 'delay_ms',   name: 'Delay Applied (ms)', dataType: 'number' },
    { id: 'delayed_at', name: 'Delay Started At',   dataType: 'string' },
    { id: 'resumed_at', name: 'Resumed At',          dataType: 'string' },
  ],
  config: [
    { key: 'delay_ms', label: 'Delay (ms)', type: 'number', required: true, defaultValue: 1000,
      description: 'Milliseconds to wait. Clamped to 300,000 ms (5 min) maximum.' },
  ],
};

// ── Collected manifest array ──────────────────────────────────────────────────

export const nodeManifests: NodeManifestV2[] = [
  coreLoggerManifest,
  coreCronTriggerManifest,
  coreHumanApprovalManifest,
  workflowConditionManifest,
  artifactWriteManifest,
  artifactReadManifest,
  projectSaveArtifactManifest,
  projectReadArtifactManifest,
  resourceCreateManifest,
  resourceReadManifest,
  resourceUpdateManifest,
  resourceTransitionManifest,
  resourceListManifest,
  eventPublishManifest,
  stateChangeManifest,
  // Phase 6
  coreLoopManifest,
  coreParallelManifest,
  coreMergeManifest,
  // Phase 10
  coreDelayManifest,
];
