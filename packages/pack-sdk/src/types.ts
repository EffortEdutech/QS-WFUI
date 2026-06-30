/**
 * @lados/pack-sdk — Core types
 * Sprint 5 (S5-002)
 */

import type { NodeManifestV2 } from '@lados/node-sdk';

// ── Resource view configuration ───────────────────────────────────────────────
//
// Declared per resource type in the pack manifest.
// The generic /resources page reads this to render type-aware, mobile-first
// card layouts and contextual inline actions without any hardcoded solution pages.
//
// See docs/LCE_V1/Lados_Core_Engine_V1_Implementation_Blueprint.md §4.3 and §3.10

export interface ResourceInlineAction {
  /** Label shown on the action button */
  label: string;
  /** Node type to invoke when the action is triggered */
  node: string;
  /** Action is only visible when the resource is in one of these states */
  visibleInStates: string[];
  /** Optional: icon for the action button */
  icon?: string;
  /** If true, show a confirmation dialog before executing */
  requiresConfirm?: boolean;
}

export interface ResourceListViewConfig {
  /** Field path for the main card title. Supports dot notation: "data.title" */
  primaryField: string;
  /** Field path for the subtitle / secondary line */
  secondaryField?: string;
  /** Field path for the state/status badge */
  badgeField?: string;
  /** Field path for a numeric counter shown on the card (e.g. trip count) */
  counterField?: string;
  /** 'card' = mobile-first tap target; 'row' = desktop table row */
  mobileLayout?: 'card' | 'row';
}

export interface ResourceViewConfig {
  list: ResourceListViewConfig;
  /** Quick actions surfaced directly on each card / row */
  inlineActions?: ResourceInlineAction[];
}

export interface PackResourceDefinition {
  /** Matches a value in the lados_resources.type CHECK constraint */
  type: string;
  displayName: string;
  /** Plural label for list headings */
  displayNamePlural?: string;
  /** Emoji or icon name for the resource type chip */
  icon?: string;
  /** Type-aware rendering config for the generic /resources page */
  views?: ResourceViewConfig;
}

// ── Pack manifest ────────────────────────────────────────────────────────────

export interface PackManifest {
  /** Unique dotted-path ID e.g. "lados.contractor-pack" */
  id: string;
  version: string;
  displayName: string;
  description?: string;
  author?: string;
  /** Minimum Node SDK version required */
  sdkVersion?: string;
  /** Other pack IDs this pack depends on */
  dependencies?: string[];
  /** Node type IDs this pack provides */
  nodes: string[];
  /**
   * Resource types this pack contributes, with optional view configurations.
   * The generic /resources page reads this to render type-aware cards and
   * inline actions without any hardcoded solution-specific pages.
   */
  resources?: PackResourceDefinition[];
  /**
   * Paths to pre-configured workflow template JSON files (relative to pack root).
   * Exposed via GET /packs/:id/templates.
   * Users select a template in the "Start from Template" modal; the platform
   * clones the JSON into their canvas with fresh IDs.
   */
  workflowTemplates?: string[];
  /** Permissions this pack requires */
  permissions?: PackPermission[];
  /** Pack icon URL or name */
  icon?: string;
  /** Brand colour for UI */
  color?: string;
}

// ── Permission ───────────────────────────────────────────────────────────────

export type PackPermissionScope =
  | 'read:files'
  | 'write:files'
  | 'read:database'
  | 'write:database'
  | 'call:ai'
  | 'call:external-api'
  | 'read:secrets'
  | 'send:email'
  | 'send:notification';

export interface PackPermission {
  scope: PackPermissionScope;
  reason: string;
}

// ── Node registration ────────────────────────────────────────────────────────

export interface PackNodeRegistration {
  manifest: NodeManifestV2;
  /** Pack that owns this node */
  packId: string;
  /** Whether this node is enabled by default when pack is installed */
  enabledByDefault?: boolean;
}

// ── Validation ───────────────────────────────────────────────────────────────

export interface PackValidationIssue {
  field: string;
  message: string;
}

export interface PackValidationResult {
  valid: boolean;
  issues: PackValidationIssue[];
}
