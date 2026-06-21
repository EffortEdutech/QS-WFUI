import type {
  QSWorkflowDefinition,
  WorkflowNodeInstance,
  WorkflowConnection,
} from '@lados/shared-types';
import type { WorkflowId, NodeInstanceId, NodeTypeId } from '@lados/shared-types';
import { WORKFLOW_SCHEMA_VERSION } from './constants';

/**
 * WorkflowBuilder — fluent helper for constructing a valid QSWorkflowDefinition.
 *
 * Used by tests, seeds, and the API when creating a blank workflow.
 *
 * @example
 *   const def = new WorkflowBuilder('My Workflow', 'wf-123' as WorkflowId)
 *     .addNode({ id: 'n1' as NodeInstanceId, type: 'core.start' as NodeTypeId, position: { x: 0, y: 0 } })
 *     .addNode({ id: 'n2' as NodeInstanceId, type: 'core.end' as NodeTypeId, position: { x: 200, y: 0 } })
 *     .addConnection({ id: 'c1', sourceNodeId: 'n1' as NodeInstanceId, sourcePortId: 'out', targetNodeId: 'n2' as NodeInstanceId, targetPortId: 'in' })
 *     .build();
 */
export class WorkflowBuilder {
  private nodes: WorkflowNodeInstance[] = [];
  private connections: WorkflowConnection[] = [];

  constructor(
    private readonly name: string,
    private readonly id: WorkflowId,
    private readonly version = '1.0.0',
  ) {}

  addNode(node: WorkflowNodeInstance): this {
    this.nodes.push(node);
    return this;
  }

  addConnection(conn: WorkflowConnection): this {
    this.connections.push(conn);
    return this;
  }

  build(): QSWorkflowDefinition {
    const now = new Date().toISOString();
    return {
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      workflow: {
        id: this.id,
        name: this.name,
        version: this.version,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      },
      nodes: this.nodes,
      connections: this.connections,
    };
  }

  /** Create a minimal blank workflow definition (Start + End nodes) */
  static blank(name: string, id: WorkflowId): QSWorkflowDefinition {
    return new WorkflowBuilder(name, id)
      .addNode({
        id: 'node-start' as NodeInstanceId,
        type: 'core.start' as NodeTypeId,
        label: 'Start',
        position: { x: 100, y: 200 },
        config: {},
      })
      .addNode({
        id: 'node-end' as NodeInstanceId,
        type: 'core.end' as NodeTypeId,
        label: 'End',
        position: { x: 500, y: 200 },
        config: {},
      })
      .build();
  }
}
