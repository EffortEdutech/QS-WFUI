"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.manifest = exports.PACK_VERSION = exports.PACK_ID = void 0;
exports.resolveNode = resolveNode;
const core_human_approval_1 = require("./nodes/core-human-approval");
const core_logger_1 = require("./nodes/core-logger");
const core_cron_trigger_1 = require("./nodes/core-cron-trigger");
const workflow_condition_1 = require("./nodes/workflow-condition");
const project_save_artifact_1 = require("./nodes/project-save-artifact");
const project_read_artifact_1 = require("./nodes/project-read-artifact");
exports.PACK_ID = 'core-pack';
exports.PACK_VERSION = '0.2.0';
exports.manifest = {
    id: exports.PACK_ID,
    version: exports.PACK_VERSION,
    displayName: 'Core Pack',
    description: 'Fundamental workflow control nodes — Logger, CronTrigger, HumanApproval, Condition, Artifact store',
    author: 'Lados Platform',
    nodes: [
        'core.logger',
        'core.cron_trigger',
        'core.human_approval',
        'workflow.condition',
        'project.save_artifact',
        'project.read_artifact',
    ],
};
function resolveNode(services = {}) {
    const { notificationService } = services;
    const nodes = {
        'core.human_approval': (ctx) => (0, core_human_approval_1.realHumanApproval)(ctx, notificationService),
        'core.logger': (ctx) => (0, core_logger_1.realLogger)(ctx),
        'core.cron_trigger': (ctx) => (0, core_cron_trigger_1.realCronTrigger)(ctx),
        'workflow.condition': (ctx) => (0, workflow_condition_1.realCondition)(ctx),
        'project.save_artifact': (ctx) => (0, project_save_artifact_1.realSaveArtifact)(ctx),
        'project.read_artifact': (ctx) => (0, project_read_artifact_1.realReadArtifact)(ctx),
    };
    return (nodeType) => nodes[nodeType] ?? null;
}
//# sourceMappingURL=index.js.map