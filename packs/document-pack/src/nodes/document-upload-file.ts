/**
 * Real implementation: document.upload_file
 *
 * Pass-through node that forwards the runtime file_id from:
 *   1. ctx.inputs['file_id']  — provided by the run payload (upload panel)
 *   2. ctx.config['file_id']  — static fallback (rarely used)
 *
 * When the downstream document.read_excel has library_file_id configured,
 * this node's output is intentionally ignored. The node must still succeed
 * (not fail) so the rest of the workflow can proceed.
 */
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

export async function realUploadFile(ctx: NodeContext): Promise<NodeExecuteResult> {
  const fileId =
    (ctx.inputs['file_id'] as string | undefined) ??
    (ctx.config['file_id'] as string | undefined) ??
    null;

  if (fileId) {
    ctx.logger.info(`Upload node: passing file_id ${fileId}`);
  } else {
    ctx.logger.info(
      'Upload node: no file_id in inputs or config — ' +
      'downstream nodes should use library_file_id.',
    );
  }

  return {
    status: 'success',
    outputs: { file_id: fileId ?? '' },
    logs: [],
    summary: fileId ? `File ready: ${fileId}` : 'No upload — using library file',
  };
}
