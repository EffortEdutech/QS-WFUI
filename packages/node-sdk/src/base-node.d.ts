import type { NodeManifest, NodeContext, NodeExecuteResult, NodeValidationResult } from './types';
export declare abstract class BaseNode {
    abstract getManifest(): NodeManifest;
    abstract execute(ctx: NodeContext): Promise<NodeExecuteResult>;
    validate(ctx: NodeContext): NodeValidationResult;
    onSuccess(_ctx: NodeContext, _result: NodeExecuteResult): void;
    onFailure(_ctx: NodeContext, _error: unknown): void;
    destroy(): void;
    protected success(outputs: Record<string, unknown>, summary?: string): NodeExecuteResult;
    protected failure(code: string, message: string, details?: unknown): NodeExecuteResult;
    protected pendingApproval(outputs: Record<string, unknown>, request: {
        title: string;
        description: string;
        assigneeRole?: string;
    }): NodeExecuteResult;
}
//# sourceMappingURL=base-node.d.ts.map