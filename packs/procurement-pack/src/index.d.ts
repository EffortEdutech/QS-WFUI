import type { PackManifest } from '@lados/pack-sdk';
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
export { type ILibraryService } from './nodes/procurement-generate-rfq';
export { type RfqArtifact } from './nodes/procurement-generate-rfq';
export { type PoArtifact, type PoLineItem } from './nodes/procurement-generate-po';
export declare const PACK_ID: "procurement-pack";
export declare const PACK_VERSION: "0.2.0";
export declare const manifest: PackManifest;
export interface ProcurementPackServices {
    libraryService: import('./nodes/procurement-generate-rfq').ILibraryService;
}
type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;
export declare function resolveNode(services: ProcurementPackServices): (nodeType: string) => NodeExecutor | null;
//# sourceMappingURL=index.d.ts.map