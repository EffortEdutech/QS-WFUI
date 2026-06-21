import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
type NotificationType = 'approval_request' | 'execution_complete' | 'execution_failed' | 'data_pack_update' | 'quota_warning' | 'system';
export interface INotificationService {
    notify(payload: {
        userId: string;
        orgId?: string;
        type: NotificationType;
        title: string;
        body?: string;
        actionUrl?: string;
        metadata?: Record<string, unknown>;
    }): Promise<string | null>;
}
export declare function realHumanApproval(ctx: NodeContext, notificationService?: INotificationService): Promise<NodeExecuteResult>;
export {};
//# sourceMappingURL=core-human-approval.d.ts.map