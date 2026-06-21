export declare const WorkflowStatus: {
    readonly DRAFT: "draft";
    readonly PUBLISHED: "published";
    readonly ARCHIVED: "archived";
};
export type WorkflowStatus = (typeof WorkflowStatus)[keyof typeof WorkflowStatus];
export declare const ExecutionStatus: {
    readonly PENDING: "pending";
    readonly RUNNING: "running";
    readonly COMPLETED: "completed";
    readonly FAILED: "failed";
    readonly CANCELLED: "cancelled";
};
export type ExecutionStatus = (typeof ExecutionStatus)[keyof typeof ExecutionStatus];
export declare const NodeExecutionStatus: {
    readonly PENDING: "pending";
    readonly RUNNING: "running";
    readonly COMPLETED: "completed";
    readonly FAILED: "failed";
    readonly SKIPPED: "skipped";
};
export type NodeExecutionStatus = (typeof NodeExecutionStatus)[keyof typeof NodeExecutionStatus];
export declare const OrganizationRole: {
    readonly OWNER: "owner";
    readonly ADMIN: "admin";
    readonly MEMBER: "member";
    readonly VIEWER: "viewer";
};
export type OrganizationRole = (typeof OrganizationRole)[keyof typeof OrganizationRole];
export declare const ProjectStatus: {
    readonly ACTIVE: "active";
    readonly ON_HOLD: "on_hold";
    readonly COMPLETED: "completed";
    readonly ARCHIVED: "archived";
};
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];
//# sourceMappingURL=status.d.ts.map