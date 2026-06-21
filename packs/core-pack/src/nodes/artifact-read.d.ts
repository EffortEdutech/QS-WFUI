import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

export interface IArtifactReadService {
    readArtifact(projectId: string, key: string, required?: boolean): Promise<{
        id: string;
        artifact_key: string;
        data: Record<string, unknown> | null;
        version: number;
    } | null>;
}

export declare function realArtifactRead(ctx: NodeContext, artifactService?: IArtifactReadService): Promise<NodeExecuteResult>;
//# sourceMappingURL=artifact-read.d.ts.map
