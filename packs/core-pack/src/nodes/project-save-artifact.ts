/**
 * project.save_artifact — Real Node
 *
 * Saves node inputs to the project_artifacts table under a named key.
 * Downstream workflows read this artifact using project.read_artifact.
 *
 * Config:
 *   artifact_key   (string, required) — name to save under, e.g. "rfq_package"
 *   include_keys   (string[], optional) — subset of input keys to save; defaults to all
 *
 * Sprint 11 (S11-004)
 */
import { createClient } from '@supabase/supabase-js';
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

export async function realSaveArtifact(ctx: NodeContext): Promise<NodeExecuteResult> {
  const artifactKey = ctx.config['artifact_key'] as string | undefined;
  if (!artifactKey) {
    return {
      status: 'failure',
      outputs: {},
      error: {
        code: 'NO_ARTIFACT_KEY',
        message: 'artifact_key config is required for project.save_artifact node.',
      },
    };
  }

  const includeKeys = ctx.config['include_keys'] as string[] | undefined;

  // Build value — either all inputs or a subset
  let value: Record<string, unknown>;
  if (includeKeys && includeKeys.length > 0) {
    value = {};
    for (const k of includeKeys) {
      if (k in ctx.inputs) value[k] = ctx.inputs[k];
    }
  } else {
    value = { ...ctx.inputs };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await supabase
    .from('project_artifacts')
    .upsert(
      {
        project_id: ctx.projectId,
        artifact_key: artifactKey,
        value,
        source_workflow_id: ctx.workflowId ?? null,
        execution_run_id: ctx.executionId ?? null,
      },
      { onConflict: 'project_id,artifact_key' },
    );

  if (error) {
    return {
      status: 'failure',
      outputs: {},
      error: { code: 'ARTIFACT_SAVE_FAILED', message: error.message },
    };
  }

  ctx.logger.info(`Artifact "${artifactKey}" saved (${Object.keys(value).length} keys)`);

  return {
    status: 'success',
    outputs: {
      saved: true,
      artifact_key: artifactKey,
      saved_at: new Date().toISOString(),
      keys_saved: Object.keys(value),
    },
  };
}
