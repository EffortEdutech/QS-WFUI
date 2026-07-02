/**
 * PD-2 — Pack manifest validation.
 * One parameterized suite asserting every official pack ships well-formed
 * NodeManifestV2 declarations: unique node types, valid semver, unique
 * port/config ids, and a callable resolveNode.
 */
import * as corePack from '@lados/core-pack';
import * as foundationPack from '@lados/foundation-pack';
import * as contractorPack from '@lados/contractor-pack';
import * as constructionPack from '@lados/construction-pack';
import * as financePack from '@lados/finance-pack';
import * as notificationsPack from '@lados/notifications-pack';
import * as documentPack from '@lados/document-pack';
import * as procurementPack from '@lados/procurement-pack';
import * as qsPack from '@lados/qs-pack';

const SEMVER = /^\d+\.\d+\.\d+/;

const packs: Array<[string, Record<string, unknown>]> = [
  ['core-pack', corePack],
  ['foundation-pack', foundationPack],
  ['contractor-pack', contractorPack],
  ['construction-pack', constructionPack],
  ['finance-pack', financePack],
  ['notifications-pack', notificationsPack],
  ['document-pack', documentPack],
  ['procurement-pack', procurementPack],
  ['qs-pack', qsPack],
];

interface ManifestLike {
  type: string;
  name: string;
  version: string;
  inputs?: Array<{ id: string }>;
  outputs?: Array<{ id: string }>;
  config?: Array<{ key: string }>;
}

function manifestsOf(pack: Record<string, unknown>): ManifestLike[] {
  const m = pack['nodeManifests'];
  if (Array.isArray(m)) return m as ManifestLike[];
  if (m && typeof m === 'object') return Object.values(m) as ManifestLike[];
  return [];
}

describe.each(packs)('%s', (packName, pack) => {
  it('exports nodeManifests and a callable resolveNode', () => {
    expect(manifestsOf(pack).length).toBeGreaterThan(0);
    expect(typeof pack['resolveNode']).toBe('function');
  });

  it('every manifest has type, name, and semver version', () => {
    for (const m of manifestsOf(pack)) {
      expect(typeof m.type).toBe('string');
      expect(m.type.length).toBeGreaterThan(0);
      expect(typeof m.name).toBe('string');
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.version).toMatch(SEMVER);
    }
  });

  it('node types are unique within the pack', () => {
    const types = manifestsOf(pack).map((m) => m.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('port ids and config keys are unique per node', () => {
    for (const m of manifestsOf(pack)) {
      const inputIds = (m.inputs ?? []).map((p) => p.id);
      const outputIds = (m.outputs ?? []).map((p) => p.id);
      const configKeys = (m.config ?? []).map((c) => c.key);
      expect(new Set(inputIds).size).toBe(inputIds.length);
      expect(new Set(outputIds).size).toBe(outputIds.length);
      expect(new Set(configKeys).size).toBe(configKeys.length);
    }
  });
});

describe('cross-pack registry integrity', () => {
  it('node types are globally unique across all packs', () => {
    const all = packs.flatMap(([name, pack]) => manifestsOf(pack).map((m) => `${m.type}`));
    const dupes = all.filter((t, i) => all.indexOf(t) !== i);
    expect(dupes).toEqual([]);
  });
});
