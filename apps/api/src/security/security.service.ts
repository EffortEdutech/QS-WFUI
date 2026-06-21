/**
 * SecurityEngineService — Phase 6 (Security Engine Hardening)
 *
 * Centralises permission enforcement for the Lados platform.
 * Replaces ad-hoc assertMembership() calls scattered across services.
 *
 * Role hierarchy (Contractor Edition):
 *   owner    >  admin  >  member  >  driver | operator  >  viewer
 *
 *   owner:    full control, manages org, users, financial approval
 *   admin:    manages resources, workflows, approvals; no billing
 *   member:   creates resources, triggers workflows, submits data
 *   driver:   creates + updates own trips; no financial or org access
 *   operator: creates + updates fleet/equipment; no financial access
 *   viewer:   read-only across the org
 *
 * Permission model:
 *   - Each action string maps to a minimum required role level.
 *   - driver and operator are parallel specialised roles at the same
 *     authority level; they are checked by explicit allowlists.
 *   - API key access is evaluated identically — the key carries a role.
 *
 * AI guardrail: SecurityEngine never grants approval or certification
 * permissions based on AI output. All approval.decide actions require
 * a human member with at minimum owner or admin role.
 */

import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

// ── Role types ────────────────────────────────────────────────────────────────

export type OrgRole = 'owner' | 'admin' | 'member' | 'driver' | 'operator' | 'viewer';

// Ordered hierarchy — index 0 = highest authority.
// driver and operator are parallel (same index), checked separately.
const ROLE_HIERARCHY: OrgRole[] = ['owner', 'admin', 'member', 'viewer'];
const PARALLEL_ROLES: OrgRole[] = ['driver', 'operator'];

// ── Permission matrix ─────────────────────────────────────────────────────────
//
// Each action maps to the minimum hierarchy role OR a list of allowed roles.
// Format: string → string[] (explicit allowlist)
//
// Unspecified actions default to ['owner', 'admin', 'member'] (general member access).

const PERMISSION_MATRIX: Record<string, OrgRole[]> = {
  // Organisation management
  'org.manage':            ['owner'],
  'org.view':              ['owner', 'admin', 'member', 'driver', 'operator', 'viewer'],
  'members.manage':        ['owner', 'admin'],
  'members.view':          ['owner', 'admin', 'member'],

  // API key management
  'api_key.create':        ['owner', 'admin'],
  'api_key.revoke':        ['owner', 'admin'],
  'api_key.list':          ['owner', 'admin', 'member'],

  // Workflow management
  'workflow.create':       ['owner', 'admin', 'member'],
  'workflow.publish':      ['owner', 'admin'],
  'workflow.trigger':      ['owner', 'admin', 'member'],
  'workflow.view':         ['owner', 'admin', 'member', 'driver', 'operator', 'viewer'],
  'workflow.delete':       ['owner', 'admin'],

  // Workflow execution
  'execution.view':        ['owner', 'admin', 'member', 'driver', 'operator', 'viewer'],

  // Resources
  'resource.create':       ['owner', 'admin', 'member', 'driver', 'operator'],
  'resource.read':         ['owner', 'admin', 'member', 'driver', 'operator', 'viewer'],
  'resource.update':       ['owner', 'admin', 'member', 'driver', 'operator'],
  'resource.transition':   ['owner', 'admin', 'member', 'driver', 'operator'],
  'resource.delete':       ['owner', 'admin'],
  'resource.list':         ['owner', 'admin', 'member', 'driver', 'operator', 'viewer'],

  // Approvals
  'approval.view':         ['owner', 'admin', 'member', 'driver', 'operator', 'viewer'],
  'approval.decide':       ['owner', 'admin'],     // AI guardrail — only humans with this role

  // State machines
  'state_machine.view':    ['owner', 'admin', 'member', 'driver', 'operator', 'viewer'],
  'state_machine.manage':  ['owner', 'admin'],

  // Events
  'event.view':            ['owner', 'admin', 'member', 'driver', 'operator', 'viewer'],
  'event.publish':         ['owner', 'admin', 'member'],
  'event_subscription.manage': ['owner', 'admin'],

  // Files and library
  'file.upload':           ['owner', 'admin', 'member', 'driver', 'operator'],
  'file.delete':           ['owner', 'admin'],
  'library.read':          ['owner', 'admin', 'member', 'driver', 'operator', 'viewer'],
  'library.write':         ['owner', 'admin', 'member'],

  // Suppliers / RFQ (procurement features)
  'supplier.manage':       ['owner', 'admin'],
  'supplier.view':         ['owner', 'admin', 'member'],
  'rfq.create':            ['owner', 'admin', 'member'],
  'quotation.view':        ['owner', 'admin', 'member'],

  // General membership (any authenticated member of the org)
  'membership':            ['owner', 'admin', 'member', 'driver', 'operator', 'viewer'],
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class SecurityEngineService {
  private readonly logger = new Logger(SecurityEngineService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ── Role lookup ───────────────────────────────────────────────────────────

  /**
   * Return the user's role in the org, or null if not a member.
   */
  async getRole(userId: string, orgId: string): Promise<OrgRole | null> {
    const { data } = await this.supabase.admin
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', orgId)
      .maybeSingle();

    return (data?.['role'] as OrgRole | undefined) ?? null;
  }

  /**
   * Return true if the user is any kind of member of the org.
   */
  async isMember(userId: string, orgId: string): Promise<boolean> {
    const role = await this.getRole(userId, orgId);
    return role !== null;
  }

  // ── Permission check ──────────────────────────────────────────────────────

  /**
   * Check whether a member with the given role is allowed to perform an action.
   * This is the pure logic check — no DB call required.
   */
  roleAllows(role: OrgRole, action: string): boolean {
    const allowed = PERMISSION_MATRIX[action] ?? ['owner', 'admin', 'member'];
    return allowed.includes(role);
  }

  /**
   * Check whether userId is a member of orgId AND their role allows action.
   * Returns { allowed, role } — never throws.
   */
  async checkPermission(
    userId: string,
    orgId: string,
    action: string,
  ): Promise<{ allowed: boolean; role: OrgRole | null }> {
    const role = await this.getRole(userId, orgId);
    if (!role) return { allowed: false, role: null };
    return { allowed: this.roleAllows(role, action), role };
  }

  /**
   * Assert userId can perform action in orgId.
   * Throws ForbiddenException (403) on failure.
   * Throws NotFoundException (404) if not a member at all.
   */
  async requirePermission(
    userId: string,
    orgId: string,
    action: string,
  ): Promise<OrgRole> {
    const { allowed, role } = await this.checkPermission(userId, orgId, action);

    if (!role) {
      throw new NotFoundException('Access denied — not a member of this organisation');
    }

    if (!allowed) {
      this.logger.warn(
        `Permission denied: user ${userId} role="${role}" cannot perform "${action}" in org ${orgId}`,
      );
      throw new ForbiddenException(
        `Your role "${role}" is not permitted to perform "${action}"`,
      );
    }

    return role;
  }

  /**
   * Assert userId is any kind of member of orgId (minimum permission check).
   * Drop-in replacement for the old assertMembership() pattern.
   */
  async requireMembership(userId: string, orgId: string): Promise<OrgRole> {
    return this.requirePermission(userId, orgId, 'membership');
  }

  // ── Role metadata ─────────────────────────────────────────────────────────

  /**
   * Return all roles allowed to perform an action.
   * Useful for the UI to show/hide controls.
   */
  getAllowedRoles(action: string): OrgRole[] {
    return (PERMISSION_MATRIX[action] ?? ['owner', 'admin', 'member']) as OrgRole[];
  }

  /**
   * Return all actions that the given role is permitted to perform.
   */
  getPermissionsForRole(role: OrgRole): string[] {
    return Object.entries(PERMISSION_MATRIX)
      .filter(([, roles]) => roles.includes(role))
      .map(([action]) => action);
  }

  /**
   * Return the full permission matrix (for admin UI / debugging).
   */
  getMatrix(): Record<string, OrgRole[]> {
    return PERMISSION_MATRIX;
  }

  // ── API key permission check ──────────────────────────────────────────────

  /**
   * Check whether a resolved API key role allows an action.
   * Used by ApiKeyGuard after the key has been verified.
   */
  apiKeyRoleAllows(keyRole: OrgRole, action: string): boolean {
    return this.roleAllows(keyRole, action);
  }
}
