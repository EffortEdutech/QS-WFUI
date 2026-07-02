import type { ResourceBinding } from '@lados/shared-types';

interface ResourceBindingRow {
  id: string;
  org_id: string;
  project_id: string | null;
  workflow_id: string;
  node_id: string;
  binding_key: string;
  resource_id: string;
  resource_type: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function toResourceBinding(row: ResourceBindingRow): ResourceBinding {
  return {
    id: row.id,
    orgId: row.org_id,
    projectId: row.project_id,
    workflowId: row.workflow_id,
    nodeId: row.node_id,
    bindingKey: row.binding_key,
    resourceId: row.resource_id,
    resourceType: row.resource_type,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type { ResourceBindingRow };
