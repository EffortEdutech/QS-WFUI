import type { QSWorkflowDefinition, WorkflowNodeInstance, WorkflowConnection } from '@lados/shared-types';
import type { WorkflowId } from '@lados/shared-types';
export declare class WorkflowBuilder {
    private readonly name;
    private readonly id;
    private readonly version;
    private nodes;
    private connections;
    constructor(name: string, id: WorkflowId, version?: string);
    addNode(node: WorkflowNodeInstance): this;
    addConnection(conn: WorkflowConnection): this;
    build(): QSWorkflowDefinition;
    static blank(name: string, id: WorkflowId): QSWorkflowDefinition;
}
//# sourceMappingURL=builder.d.ts.map