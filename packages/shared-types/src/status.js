"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectStatus = exports.OrganizationRole = exports.NodeExecutionStatus = exports.ExecutionStatus = exports.WorkflowStatus = void 0;
exports.WorkflowStatus = {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    ARCHIVED: 'archived',
};
exports.ExecutionStatus = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
};
exports.NodeExecutionStatus = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    SKIPPED: 'skipped',
};
exports.OrganizationRole = {
    OWNER: 'owner',
    ADMIN: 'admin',
    MEMBER: 'member',
    VIEWER: 'viewer',
};
exports.ProjectStatus = {
    ACTIVE: 'active',
    ON_HOLD: 'on_hold',
    COMPLETED: 'completed',
    ARCHIVED: 'archived',
};
//# sourceMappingURL=status.js.map