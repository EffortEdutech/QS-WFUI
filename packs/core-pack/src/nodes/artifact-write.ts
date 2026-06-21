/**
 * artifact.write
 *
 * Writes a named artifact to the project's artifact store.
 * Other workflows in the same project can read it via artifact.read.
 *
 * Config (design-time):
 *   key        (string, required) — artifact name, e.g. "current_job"
 *   type       (select, optional) — 'json' | 'text' | 'file' (default: 'json')
 *
 * Runtime inputs:
 *   value      (object, required) — data to store
 *   key        (string, optional) — overrides config key at runtime
 *
 * Outputs:
 *   artifactId  — DB id of the artifact record
 *   key         — the artifact key used
 *   version     — new version number after write
 *
 * Phase 9 Correction — replaces project.save_artifact
 * See docs/LCE_V1/Lados_Core_Engine_V1_Implementation_Blueprint.md §4.10
 */
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

// ── Service interface ─────────────────────────────────────────────────────────

export interface IArtifactWriteService {
  upsertArtifact(params: {
    organisationId: string;
    projectId:      string;
    key:            string;
    type?:          'json' | 'text' | 'file';
    data?:          Record<string, unknown>;
    fileUrl?:       string;
    workflowId?:    string;
    runId?:         string;
    createdBy?:     string;
  }): Promise<{ id: string; artifact_key: string; version: number }>;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'ARTIFACT_WRITE_ERROR', message } };
}

// ── Node implementation ───────────────────────────────────────────────────────

export async function realArtifactWrite(
  ctx: NodeContext,
  artifactService?: IArtifactWriteService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;

  const key   = (inp['key']   as string | undefined) ?? (ctx.config['key']   as string | undefined);
  const type  = (ctx.config['type'] as 'json' | 'text' | 'file' | undefined) ?? 'json';
  const value = (inp['value'] as Record<string, unknown> | undefined) ?? inp;

  if (!key)                return err('artifact.write: key is required (set in config or pass via input)');
  if (!ctx.projectId)      return err('artifact.write: projectId missing from context');
  if (!ctx.organizationId) return err('artifact.write: organizationId missing from context');
  if (!artifactService)    return err('artifact.write: artifactService not injected');

  const record = await artifactService.upsertArtifact({
    organisationId: ctx.organizationId,
    projectId:      ctx.projectId,
    key,
    type,
    data:           type === 'json' ? value : undefined,
    workflowId:     ctx.workflowId,
    runId:          ctx.executionId,
    createdBy:      ctx.userId,
  });

  ctx.logger.info(`artifact.write: "${key}" v${record.version} saved`);

  return {
    status: 'success',
    outputs: {
      artifactId: record.id,
      key:        record.artifact_key,
      version:    record.version,
    },
  };
}
