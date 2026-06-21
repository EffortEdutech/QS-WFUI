"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realReadArtifact = realReadArtifact;
const supabase_js_1 = require("@supabase/supabase-js");
async function realReadArtifact(ctx) {
    const artifactKey = ctx.config['artifact_key'];
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
    const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
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
    const value = data.value;
    ctx.logger.info(`Artifact "${artifactKey}" loaded (${Object.keys(value).length} keys, saved ${data.updated_at})`);
    return {
        status: 'success',
        outputs: {
            ...value,
            _artifact_key: artifactKey,
            _artifact_loaded_at: new Date().toISOString(),
            _artifact_source_workflow: data.source_workflow_id,
        },
    };
}
//# sourceMappingURL=project-read-artifact.js.map