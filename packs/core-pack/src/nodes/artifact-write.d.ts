import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

export interface IArtifactWriteService {
    upsertArtifact(params: {
        organisationId: string;
        projectId: string;
        key: string;
        type?: 'json' | 'text' | 'file';
        data?: Record<string, unknown>;
        fileUrl?: string;
        workflowId?: string;
        runId?: string;
        createdBy?: string;
    }): Promise<{ id: string; artifact_key: string; version: number }>;
}

export declare function realArtifactWrite(ctx: NodeContext, artifactService?: IArtifactWriteService): Promise<NodeExecuteResult>;
//# sourceMappingURL=artifact-write.d.ts.map
