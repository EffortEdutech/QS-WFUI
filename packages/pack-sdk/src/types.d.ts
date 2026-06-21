import type { NodeManifest } from '@lados/node-sdk';

// ── Resource view configuration (Phase 9 Correction) ─────────────────────────

export interface ResourceInlineAction {
    label: string;
    node: string;
    visibleInStates: string[];
    icon?: string;
    requiresConfirm?: boolean;
}

export interface ResourceListViewConfig {
    primaryField: string;
    secondaryField?: string;
    badgeField?: string;
    counterField?: string;
    mobileLayout?: 'card' | 'row';
}

export interface ResourceViewConfig {
    list: ResourceListViewConfig;
    inlineActions?: ResourceInlineAction[];
}

export interface PackResourceDefinition {
    type: string;
    displayName: string;
    displayNamePlural?: string;
    icon?: string;
    views?: ResourceViewConfig;
}

// ── Pack manifest ─────────────────────────────────────────────────────────────

export interface PackManifest {
    id: string;
    version: string;
    displayName: string;
    description?: string;
    author?: string;
    sdkVersion?: string;
    dependencies?: string[];
    nodes: string[];
    resources?: PackResourceDefinition[];
    workflowTemplates?: string[];
    permissions?: PackPermission[];
    icon?: string;
    color?: string;
}

export type PackPermissionScope = 'read:files' | 'write:files' | 'read:database' | 'write:database' | 'call:ai' | 'call:external-api' | 'read:secrets' | 'send:email' | 'send:notification';

export interface PackPermission {
    scope: PackPermissionScope;
    reason: string;
}

export interface PackNodeRegistration {
    manifest: NodeManifest;
    packId: string;
    enabledByDefault?: boolean;
}

export interface PackValidationIssue {
    field: string;
    message: string;
}

export interface PackValidationResult {
    valid: boolean;
    issues: PackValidationIssue[];
}
//# sourceMappingURL=types.d.ts.map
