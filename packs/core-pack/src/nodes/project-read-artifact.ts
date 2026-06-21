/**
 * project.read_artifact — Real Node
 *
 * Reads a named artifact from project_artifacts and merges its value into
 * this node's outputs, making the data available to downstream nodes.
 *
 * Config:
 *   artifact_key  (string, required) — key to read, e.g. "rfq_package"
 *
 * Fails with ARTIFACT_NOT_FOUND if the key has not been saved yet.
 *
 * Sprint 11 (S11-004)
 */
import { createClient } from '@supabase/supabase-js';
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

export async function realReadArtifact(ctx: NodeContext): Promise<NodeExecuteResult> {
  const artifactKey = ctx.config['artifact_key'] as string | undefined;
  if (!artifactKey) {
    return {
      status: 'failure',
      outputs: {},
      error: {
        code: 'NO_ARTIFACT_KEY',
        message: 'artifact_key config is required for project.read_artifact node.',
      },
    };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from('project_artifacts')
    .select('value, updated_at, source_workflow_id')
    .eq('project_id', ctx.projectId)
    .eq('artifact_key', artifactKey)
    .maybeSingle();

  if (error) {
    return {
      status: 'failure',
      outputs: {},
      error: { code: 'ARTIFACT_READ_FAILED', message: error.message },
    };
  }

  if (!data) {
    return {
      status: 'failure',
      outputs: {},
      error: {
        code: 'ARTIFACT_NOT_FOUND',
        message: `Artifact "${artifactKey}" not found. Run the upstream workflow that saves this artifact first.`,
      },
    };
  }

  const value = data.value as Record<string, unknown>;
  ctx.logger.info(`Artifact "${artifactKey}" loaded (${Object.keys(value).length} keys, saved ${data.updated_at})`);

  return {
    status: 'success',
    // Spread artifact value into outputs so downstream nodes can use directly
    outputs: {
      ...value,
      _artifact_key: artifactKey,
      _artifact_loaded_at: new Date().toISOString(),
      _artifact_source_workflow: data.source_workflow_id,
    },
  };
}
