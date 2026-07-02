export interface ResourceBinding {
  id: string;
  orgId: string;
  projectId: string | null;
  workflowId: string;
  nodeId: string;
  bindingKey: string;
  resourceId: string;
  resourceType: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedBindings {
  [nodeId: string]: Record<string, string>;
}
