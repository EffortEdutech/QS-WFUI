/**
 * artifact.read
 *
 * Reads a named artifact from the project's artifact store.
 * Written by artifact.write in a prior workflow run.
 *
 * Config (design-time):
 *   key        (string, required) — artifact name to read, e.g. "current_job"
 *   required   (boolean, optional) — if true, node fails when artifact is not found
 *
 * Runtime inputs:
 *   key        (string, optional) — overrides config key at runtime
 *
 * Outputs:
 *   value      — the stored data (null if not found and required=false)
 *   found      — boolean: whether the artifact existed
 *   version    — version number of the artifact (0 if not found)
 *   key        — the artifact key that was read
 *
 * Phase 9 Correction — replaces project.read_artifact
 * See docs/LCE_V1/Lados_Core_Engine_V1_Implementation_Blueprint.md §4.10
 */
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

// ── Service interface ─────────────────────────────────────────────────────────

export interface IArtifactReadService {
  readArtifact(
    projectId: string,
    key:       string,
    required?: boolean,
  ): Promise<{ id: string; artifact_key: string; data: Record<string, unknown> | null; version: number } | null>;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'ARTIFACT_READ_ERROR', message } };
}

// ── Node implementation ───────────────────────────────────────────────────────

export async function realArtifactRead(
  ctx: NodeContext,
  artifactService?: IArtifactReadService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;

  const key      = (inp['key'] as string | undefined) ?? (ctx.config['key'] as string | undefined);
  const required = (ctx.config['required'] as boolean | undefined) ?? false;

  if (!key)             return err('artifact.read: key is required (set in config or pass via input)');
  if (!ctx.projectId)   return err('artifact.read: projectId missing from context');
  if (!artifactService) return err('artifact.read: artifactService not injected');

  const record = await artifactService.readArtifact(ctx.projectId, key, false);

  if (!record) {
    if (required) {
      return {
        status: 'failure',
        outputs: { value: null, found: false, version: 0, key },
        error: { code: 'ARTIFACT_NOT_FOUND', message: `artifact.read: artifact "${key}" not found in project` },
      };
    }

    ctx.logger.warn(`artifact.read: "${key}" not found (required=false, continuing)`);
    return {
      status: 'success',
      outputs: { value: null, found: false, version: 0, key },
    };
  }

  ctx.logger.info(`artifact.read: "${key}" v${record.version} loaded`);

  return {
    status: 'success',
    outputs: {
      value:   record.data,
      found:   true,
      version: record.version,
      key:     record.artifact_key,
    },
  };
}
