"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realSaveArtifact = realSaveArtifact;
const supabase_js_1 = require("@supabase/supabase-js");
async function realSaveArtifact(ctx) {
    const artifactKey = ctx.config['artifact_key'];
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
    const includeKeys = ctx.config['include_keys'];
    let value;
    if (includeKeys && includeKeys.length > 0) {
        value = {};
        for (const k of includeKeys) {
            if (k in ctx.inputs)
                value[k] = ctx.inputs[k];
        }
    }
    else {
        value = { ...ctx.inputs };
    }
    const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supabase
        .from('project_artifacts')
        .upsert({
        project_id: ctx.projectId,
        artifact_key: artifactKey,
        value,
        source_workflow_id: ctx.workflowId ?? null,
        execution_run_id: ctx.executionId ?? null,
    }, { onConflict: 'project_id,artifact_key' });
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
//# sourceMappingURL=project-save-artifact.js.map