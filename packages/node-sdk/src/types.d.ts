export type PortDataType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file' | 'json' | 'boq' | 'any';
export interface NodePort {
    id: string;
    label: string;
    type: PortDataType;
    required?: boolean;
    description?: string;
    schema?: Record<string, unknown>;
}
export type ConfigFieldType = 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'textarea' | 'file' | 'json' | 'secret';
export interface ConfigFieldOption {
    value: string;
    label: string;
}
export interface ConfigField {
    key: string;
    label: string;
    type: ConfigFieldType;
    required?: boolean;
    defaultValue?: unknown;
    description?: string;
    placeholder?: string;
    options?: ConfigFieldOption[];
    validation?: {
        min?: number;
        max?: number;
        pattern?: string;
        message?: string;
    };
}
export type ConfigSchema = ConfigField[];
export type NodeCategory = 'core' | 'qs' | 'procurement' | 'document' | 'ai' | 'integration';
export interface NodeUISchema {
    title: string;
    icon?: string;
    category: NodeCategory;
    color?: string;
    description?: string;
    helpUrl?: string;
    sections?: Array<{
        title: string;
        fieldKeys: string[];
    }>;
}
export interface NodeMetadata {
    type: string;
    name: string;
    version: string;
    description?: string;
    author?: string;
    tags?: string[];
    packId: string;
}
export interface NodeManifest {
    metadata: NodeMetadata;
    inputs: NodePort[];
    outputs: NodePort[];
    configSchema: ConfigSchema;
    uiSchema: NodeUISchema;
}
export interface NodeLogger {
    info(message: string, data?: unknown): void;
    warn(message: string, data?: unknown): void;
    error(message: string, data?: unknown): void;
}
export interface NodeContext {
    executionId: string;
    workflowId: string;
    projectId: string;
    organizationId: string;
    userId: string;
    config: Record<string, unknown>;
    inputs: Record<string, unknown>;
    logger: NodeLogger;
    variables: Record<string, unknown>;
}
export type ExecutionStatus = 'success' | 'failure' | 'pending_approval' | 'paused' | 'skipped';
export interface NodeExecuteResult {
    status: ExecutionStatus;
    outputs: Record<string, unknown>;
    logs?: string[];
    summary?: string;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
    approvalRequest?: {
        title: string;
        description: string;
        assigneeRole?: string;
    };
}
export interface ValidationIssue {
    field: string;
    severity: 'error' | 'warning';
    message: string;
}
export interface NodeValidationResult {
    valid: boolean;
    issues: ValidationIssue[];
}
//# sourceMappingURL=types.d.ts.map