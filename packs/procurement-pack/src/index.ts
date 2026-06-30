/**
 * @lados/procurement-pack
 *
 * Procurement nodes — RFQ generation, Purchase Order generation.
 *
 * Phase 2: nodes migrated from apps/api/src/execution/real-nodes/
 *          Cross-pack types (WorkPackage, ClassifiedItem) imported from @lados/qs-pack.
 */
import type { PackManifest } from '@lados/pack-sdk';
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

import { realGenerateRfq } from './nodes/procurement-generate-rfq';
import { realGeneratePo }  from './nodes/procurement-generate-po';

export { type ILibraryService }  from './nodes/procurement-generate-rfq';
export { type RfqArtifact }      from './nodes/procurement-generate-rfq';
export { type PoArtifact, type PoLineItem } from './nodes/procurement-generate-po';
export { nodeManifests }         from './manifests';

export const PACK_ID      = 'procurement-pack' as const;
export const PACK_VERSION = '0.2.0' as const;

export const manifest: PackManifest = {
  id: PACK_ID,
  version: PACK_VERSION,
  displayName: 'Procurement Pack',
  description: 'Procurement capabilities — RFQ generation, quotation collection, Purchase Orders',
  author: 'Lados Platform',
  nodes: [
    'procurement.generate_rfq',
    'procurement.generate_po',
  ],
};

export interface ProcurementPackServices {
  libraryService: import('./nodes/procurement-generate-rfq').ILibraryService;
}

type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;

/**
 * Returns the real executor for a procurement-pack node type, or null if unknown.
 */
export function resolveNode(
  services: ProcurementPackServices,
): (nodeType: string) => NodeExecutor | null {
  const { libraryService } = services;

  const nodes: Record<string, NodeExecutor> = {
    'procurement.generate_rfq': (ctx) => realGenerateRfq(ctx, libraryService),
    'procurement.generate_po':  (ctx) => realGeneratePo(ctx, libraryService),
  };

  return (nodeType: string) => nodes[nodeType] ?? null;
}
