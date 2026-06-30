/**
 * @lados/pack-sdk — Pack manifest validator
 * Sprint 5 (S5-002)
 */

import type { PackManifest, PackValidationResult, PackValidationIssue } from './types';

export function validatePackManifest(manifest: unknown): PackValidationResult {
  const issues: PackValidationIssue[] = [];

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, issues: [{ field: 'root', message: 'Manifest must be an object' }] };
  }

  const m = manifest as Record<string, unknown>;

  if (!m['id'] || typeof m['id'] !== 'string') {
    issues.push({ field: 'id', message: 'Pack id is required and must be a string' });
  } else if (!/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(m['id'] as string)) {
    issues.push({ field: 'id', message: 'Pack id must follow dotted-path format e.g. "lados.qs-pack"' });
  }

  if (!m['version'] || typeof m['version'] !== 'string') {
    issues.push({ field: 'version', message: 'Pack version is required' });
  }

  if (!m['displayName'] || typeof m['displayName'] !== 'string') {
    issues.push({ field: 'displayName', message: 'Pack displayName is required' });
  }

  if (!Array.isArray(m['nodes'])) {
    issues.push({ field: 'nodes', message: 'Pack nodes must be an array of node type IDs' });
  } else if ((m['nodes'] as unknown[]).some((n) => typeof n !== 'string')) {
    issues.push({ field: 'nodes', message: 'All entries in nodes must be strings' });
  }

  return { valid: issues.length === 0, issues };
}

export function assertPackManifest(manifest: unknown): PackManifest {
  const result = validatePackManifest(manifest);
  if (!result.valid) {
    const summary = result.issues.map((i) => `${i.field}: ${i.message}`).join('; ');
    throw new Error(`Invalid PackManifest — ${summary}`);
  }
  return manifest as PackManifest;
}
