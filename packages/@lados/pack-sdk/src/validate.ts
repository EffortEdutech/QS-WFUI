/**
 * @lados/pack-sdk — Pack manifest validator (V2)
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

  // V2 — validate stateMachines if present
  if (m['stateMachines'] !== undefined) {
    if (!Array.isArray(m['stateMachines'])) {
      issues.push({ field: 'stateMachines', message: 'stateMachines must be an array' });
    } else {
      (m['stateMachines'] as unknown[]).forEach((sm, i) => {
        const s = sm as Record<string, unknown>;
        if (!s['resourceType'] || typeof s['resourceType'] !== 'string') {
          issues.push({ field: `stateMachines[${i}].resourceType`, message: 'resourceType is required' });
        }
        if (!s['initial'] || typeof s['initial'] !== 'string') {
          issues.push({ field: `stateMachines[${i}].initial`, message: 'initial state is required' });
        }
        if (!Array.isArray(s['states']) || (s['states'] as unknown[]).length === 0) {
          issues.push({ field: `stateMachines[${i}].states`, message: 'states must be a non-empty array' });
        }
        if (!Array.isArray(s['transitions'])) {
          issues.push({ field: `stateMachines[${i}].transitions`, message: 'transitions must be an array' });
        }
      });
    }
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
