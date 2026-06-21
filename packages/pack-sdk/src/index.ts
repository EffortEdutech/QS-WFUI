/**
 * @lados/pack-sdk
 *
 * Base types and validation for QS-OS packs.
 * Sprint 5 (S5-002) — full implementation.
 */

export const PACK_SDK_VERSION = '1.0.0' as const;

export type {
  PackManifest,
  PackPermissionScope,
  PackPermission,
  PackNodeRegistration,
  PackValidationIssue,
  PackValidationResult,
  // Resource view config types (Phase 9 Correction)
  PackResourceDefinition,
  ResourceViewConfig,
  ResourceListViewConfig,
  ResourceInlineAction,
} from './types';

export { validatePackManifest, assertPackManifest } from './validate';
