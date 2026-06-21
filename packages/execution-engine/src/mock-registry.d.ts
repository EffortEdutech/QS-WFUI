import type { NodeContext, NodeExecuteResult } from '@lados/node-sdk';
export declare function getMockExecutor(nodeType: string): (ctx: NodeContext) => Promise<NodeExecuteResult>;
export declare function hasMockFor(nodeType: string): boolean;
//# sourceMappingURL=mock-registry.d.ts.map