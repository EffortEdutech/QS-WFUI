/**
 * PD-2 — Data Pack runtime provenance resolution (Phase 19C core logic).
 * Covers resolveRuntimeUsagesForDefinition: UUID extraction from arbitrary
 * node config shapes and per-node usage grouping. DB access is stubbed at the
 * private resolveRuntimeUsages boundary, so this exercises everything above it.
 *
 * Note: full end-to-end runtime verification is deferred to the PD-4 demo
 * workflows (see P18P–P20 checklist) — this test is the interim coverage.
 */
import { DataPacksService } from './data-packs.service';

const ITEM_A = '11111111-1111-4111-8111-111111111111';
const ITEM_B = '22222222-2222-4222-8222-222222222222';
const NOT_RESOLVED = '33333333-3333-4333-8333-333333333333';

type Usage = { itemId: string; packSlug: string; advisory: boolean };

function makeService(resolved: Usage[]): DataPacksService {
  const svc = new DataPacksService({} as never, {} as never);
  // Stub the DB boundary — everything above it runs for real.
  (svc as unknown as { resolveRuntimeUsages: (ids: string[]) => Promise<Usage[]> }).resolveRuntimeUsages =
    jest.fn().mockImplementation(async (ids: string[]) => resolved.filter((u) => ids.includes(u.itemId)));
  return svc;
}

function definitionWith(nodes: Array<{ id: string; config: Record<string, unknown> }>): never {
  return { nodes: nodes.map((n) => ({ ...n, type: 'test.node' })), connections: [] } as unknown as never;
}

const usageA: Usage = { itemId: ITEM_A, packSlug: 'lados.qs-rate-library', advisory: true };
const usageB: Usage = { itemId: ITEM_B, packSlug: 'lados.boq-item-library', advisory: true };

describe('DataPacksService.resolveRuntimeUsagesForDefinition', () => {
  it('returns an empty map when no node config contains item ids', async () => {
    const svc = makeService([usageA]);
    const result = await svc.resolveRuntimeUsagesForDefinition(
      definitionWith([{ id: 'n1', config: { rate: 55.0, label: 'plain config' } }]),
    );
    expect(result.size).toBe(0);
  });

  it('maps a top-level item id to its node', async () => {
    const svc = makeService([usageA]);
    const result = await svc.resolveRuntimeUsagesForDefinition(
      definitionWith([{ id: 'n1', config: { rateItemId: ITEM_A } }]),
    );
    expect(result.get('n1')).toEqual([usageA]);
  });

  it('finds item ids nested in objects and arrays', async () => {
    const svc = makeService([usageA, usageB]);
    const result = await svc.resolveRuntimeUsagesForDefinition(
      definitionWith([
        { id: 'n1', config: { nested: { deep: { ref: ITEM_A } } } },
        { id: 'n2', config: { list: [{ ref: ITEM_B }, 'noise'] } },
      ]),
    );
    expect(result.get('n1')).toEqual([usageA]);
    expect(result.get('n2')).toEqual([usageB]);
  });

  it('deduplicates repeated ids within one node config', async () => {
    const svc = makeService([usageA]);
    const result = await svc.resolveRuntimeUsagesForDefinition(
      definitionWith([{ id: 'n1', config: { a: ITEM_A, b: ITEM_A, c: [ITEM_A] } }]),
    );
    expect(result.get('n1')).toHaveLength(1);
  });

  it('omits nodes whose ids do not resolve to real Data Pack items', async () => {
    const svc = makeService([usageA]); // NOT_RESOLVED intentionally absent
    const result = await svc.resolveRuntimeUsagesForDefinition(
      definitionWith([
        { id: 'n1', config: { ref: ITEM_A } },
        { id: 'n2', config: { ref: NOT_RESOLVED } },
      ]),
    );
    expect(result.has('n1')).toBe(true);
    expect(result.has('n2')).toBe(false);
  });

  it('handles a definition with no nodes', async () => {
    const svc = makeService([]);
    const result = await svc.resolveRuntimeUsagesForDefinition({ nodes: [], connections: [] } as unknown as never);
    expect(result.size).toBe(0);
  });
});
