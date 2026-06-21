'use client';

/**
 * Resources — /resources
 * Phase 9 (Platform Architecture §3.10)
 *
 * Generic resource browser. ALL resource types — jobs, trips, invoices,
 * drivers, vehicles, etc. — are accessed here via ?type= query param.
 *
 * The page drives its rendering from pack manifest view configs:
 *   GET /packs/resource-views → { [type]: { displayName, icon, views: { list, inlineActions } } }
 *
 * No industry-specific code lives here. The pack manifest tells the page
 * what fields to show and what inline actions are available per state.
 *
 * Inline actions:
 *   - node === 'state.change'  → POST /resources/:id/transition directly
 *   - other node types         → POST /resources/:id/execute-action via WorkflowActionModal
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Organization {
  id:   string;
  name: string;
  slug: string;
  membership: { role: string };
}

interface Resource {
  id:         string;
  org_id:     string;
  project_id: string | null;
  type:       string;
  name:       string;
  state:      string;
  data:       Record<string, unknown>;
  parent_id:  string | null;
  created_at: string;
  updated_at: string;
}

interface ResourceListViewConfig {
  primaryField:   string;
  secondaryField?: string;
  badgeField?:    string;
  counterField?:  string;
  mobileLayout?:  'card' | 'row';
}

interface ResourceInlineAction {
  label:           string;
  node:            string;
  visibleInStates: string[];
  icon?:           string;
  requiresConfirm?: boolean;
}

interface ResourceViewConfig {
  list:          ResourceListViewConfig;
  inlineActions?: ResourceInlineAction[];
}

interface PackResourceDefinition {
  type:              string;
  displayName:       string;
  displayNamePlural?: string;
  icon?:             string;
  views?:            ResourceViewConfig;
  packId:            string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve dot-path fields like "data.scheduledDate" from a resource object */
function getField(resource: Resource, field: string): string {
  const parts = field.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = resource;
  for (const p of parts) {
    if (cursor == null) return '';
    cursor = cursor[p];
  }
  if (cursor == null) return '';
  if (typeof cursor === 'object') return JSON.stringify(cursor);
  return String(cursor);
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

// ── State badge ───────────────────────────────────────────────────────────────

const STATE_COLORS: Record<string, string> = {
  draft:            'bg-gray-100 text-gray-600',
  active:           'bg-green-100 text-green-700',
  pending:          'bg-yellow-100 text-yellow-700',
  pending_review:   'bg-orange-100 text-orange-700',
  pending_approval: 'bg-purple-100 text-purple-700',
  in_progress:      'bg-blue-100 text-blue-700',
  completed:        'bg-teal-100 text-teal-700',
  cancelled:        'bg-red-100 text-red-600',
  available:        'bg-emerald-100 text-emerald-700',
  scheduled:        'bg-indigo-100 text-indigo-700',
};

function StateBadge({ state }: { state: string }) {
  const cls = STATE_COLORS[state] ?? 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {state.replace(/_/g, ' ')}
    </span>
  );
}

// ── Resource Card ─────────────────────────────────────────────────────────────

function ResourceCard({
  resource,
  viewConfig,
  orgId,
  onAction,
  actionBusy,
}: {
  resource:    Resource;
  viewConfig?: PackResourceDefinition;
  orgId:       string;
  onAction:    (resource: Resource, action: ResourceInlineAction) => void;
  actionBusy:  string | null; // resourceId being actioned
}) {
  const list    = viewConfig?.views?.list;
  const actions = viewConfig?.views?.inlineActions ?? [];

  const primary   = list ? getField(resource, list.primaryField)   : resource.name;
  const secondary = list?.secondaryField ? getField(resource, list.secondaryField) : null;
  const badge     = list?.badgeField     ? getField(resource, list.badgeField)     : resource.state;
  const counter   = list?.counterField   ? getField(resource, list.counterField)   : null;

  const visibleActions = actions.filter((a) => a.visibleInStates.includes(resource.state));
  const isBusy = actionBusy === resource.id;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {viewConfig?.icon && (
              <span className="text-lg flex-shrink-0">{viewConfig.icon}</span>
            )}
            <h3 className="font-semibold text-gray-900 text-sm truncate">{primary || resource.name}</h3>
          </div>
          <StateBadge state={badge || resource.state} />
        </div>

        {/* Secondary field */}
        {secondary && (
          <p className="mt-1 text-xs text-gray-500 truncate pl-7">{secondary}</p>
        )}

        {/* Counter + date */}
        <div className="mt-2 flex items-center justify-between pl-7">
          {counter ? (
            <span className="text-[11px] text-gray-400">
              <span className="font-semibold text-gray-600">{counter}</span> trips
            </span>
          ) : (
            <span className="text-[11px] text-gray-400">{fmt(resource.created_at)}</span>
          )}
          <span className="text-[10px] font-mono text-gray-300">{resource.id.slice(0, 8)}</span>
        </div>
      </div>

      {/* Inline actions */}
      {visibleActions.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-2.5 flex flex-wrap gap-2">
          {visibleActions.map((action) => {
            const isStateChange = action.node === 'state.change';
            return (
              <button
                key={action.label}
                onClick={() => onAction(resource, action)}
                disabled={isBusy}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                  isStateChange
                    ? 'bg-gray-50 border border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                    : 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300'
                }`}
              >
                {action.icon && <span>{action.icon}</span>}
                {isBusy ? '…' : action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Confirm modal ─────────────────────────────────────────────────────────────

function ConfirmModal({
  action,
  resource,
  onConfirm,
  onCancel,
  busy,
}: {
  action:    ResourceInlineAction;
  resource:  Resource;
  onConfirm: () => void;
  onCancel:  () => void;
  busy:      boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">{action.label}</h3>
        <p className="mt-2 text-sm text-gray-500">
          Are you sure you want to <strong>{action.label.toLowerCase()}</strong>{' '}
          <strong>{resource.name}</strong>? This action cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Processing…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Workflow Action Modal ─────────────────────────────────────────────────────
//
// Renders a dynamic form for any pack node that is NOT state.change.
// The form fields are derived from the node's input schema (fetched from
// GET /packs/:packId) so this component works generically for any node type.
//
// Pre-fills the resourceId field if the schema contains a matching key
// (jobId, vehicleId, resourceId, etc. that reference the current resource).
//

interface NodeInputSchema {
  key:         string;
  label:       string;
  type:        string;
  required?:   boolean;
  description?: string;
  placeholder?: string;
}

function WorkflowActionModal({
  action,
  resource,
  packId,
  orgId,
  onSuccess,
  onCancel,
}: {
  action:    ResourceInlineAction;
  resource:  Resource;
  packId:    string;
  orgId:     string;
  onSuccess: (msg: string) => void;
  onCancel:  () => void;
}) {
  const [schema,  setSchema]  = useState<NodeInputSchema[]>([]);
  const [values,  setValues]  = useState<Record<string, string>>({});
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load node input schema from the pack manifest.
  // registered_nodes.inputs format: [{ name, type, required, description? }]
  // We map `name` → `key` so the form can drive generically.
  useEffect(() => {
    if (!packId) { setLoading(false); return; }
    apiClient
      .get<{
        nodes: Array<{
          type: string;
          inputs?: Array<{ name: string; type: string; required?: boolean; description?: string }>;
        }>;
      }>(
        `/packs/${encodeURIComponent(packId)}`,
      )
      .then((res) => {
        const node = (res.data?.nodes ?? []).find((n) => n.type === action.node);
        const rawInputs = node?.inputs ?? [];

        // Map DB format → modal's NodeInputSchema (name → key, auto-label)
        const fields: NodeInputSchema[] = rawInputs.map((inp) => ({
          key:         inp.name,
          label:       inp.name
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (s) => s.toUpperCase())
            .trim(),
          type:        inp.type,
          required:    inp.required ?? false,
          description: inp.description,
        }));

        setSchema(fields);

        // Pre-fill: if the resource is a job, pre-fill jobId
        const pre: Record<string, string> = {};
        for (const f of fields) {
          if (f.key === `${resource.type}Id`) {
            pre[f.key] = resource.id;
          } else if (resource.data?.[f.key] !== undefined) {
            pre[f.key] = String(resource.data[f.key]);
          }
        }
        setValues(pre);
      })
      .catch(() => setSchema([]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId, action.node]);

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      // Build inputs — merge form values with resource context
      const inputs: Record<string, unknown> = { ...values };
      // Always pass the resource's own ID and type for nodes that need context
      inputs['resourceId'] ??= resource.id;

      const res = await apiClient.post<{ success: boolean; data: { status: string; outputs: Record<string, unknown>; error?: unknown } }>(
        `/resources/${resource.id}/execute-action?organizationId=${orgId}`,
        { node: action.node, inputs },
      );

      if (res.data?.success === false || res.data?.data?.status === 'failure') {
        const errData = res.data?.data?.error;
        const msg = typeof errData === 'object' && errData !== null && 'message' in errData
          ? String((errData as { message: string }).message)
          : JSON.stringify(errData ?? 'Action failed');
        setError(msg);
      } else {
        onSuccess(`${action.label} completed for ${resource.name}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{action.icon} {action.label}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{resource.name}</p>
          </div>
          <button onClick={onCancel} disabled={busy} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        {/* Node type badge */}
        <p className="mb-4 text-[10px] font-mono text-gray-400 bg-gray-50 rounded px-2 py-1 truncate">
          {action.node}
        </p>

        {loading && (
          <p className="text-sm text-gray-400 text-center py-6">Loading form…</p>
        )}

        {!loading && (
          <div className="space-y-3">
            {schema.length === 0 && (
              <p className="text-xs text-gray-500 italic">No additional inputs required.</p>
            )}
            {schema.map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {field.description && (
                  <p className="text-[10px] text-gray-400 mb-1">{field.description}</p>
                )}
                <input
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  placeholder={field.placeholder ?? field.label}
                  disabled={busy}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy || loading}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Running…' : action.label}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ResourcesPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const typeParam    = searchParams.get('type') ?? '';

  // ── Org state ──────────────────────────────────────────────────────────────
  const [orgs,        setOrgs]        = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  // ── View config ────────────────────────────────────────────────────────────
  const [viewConfigs, setViewConfigs] = useState<Record<string, PackResourceDefinition>>({});
  const [activeType,  setActiveType]  = useState<string>(typeParam);

  // ── Resource list ──────────────────────────────────────────────────────────
  const [resources,  setResources]  = useState<Resource[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [stateFilter, setStateFilter] = useState('');

  // ── Action state ───────────────────────────────────────────────────────────
  const [actionBusy,    setActionBusy]    = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    resource: Resource; action: ResourceInlineAction;
  } | null>(null);
  const [nodeActionTarget, setNodeActionTarget] = useState<{
    resource: Resource; action: ResourceInlineAction;
  } | null>(null);
  const [actionError,   setActionError]   = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // ── Error ──────────────────────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);

  // ── 1. Load orgs ──────────────────────────────────────────────────────────

  useEffect(() => {
    apiClient.get<Organization[]>('/organizations').then((res) => {
      const list = res.data ?? [];
      setOrgs(list);
      if (list.length > 0) setSelectedOrg(list[0]);
    });
  }, []);

  // ── 2. Load pack resource view configs ────────────────────────────────────

  useEffect(() => {
    if (!selectedOrg) return;
    apiClient
      .get<Record<string, PackResourceDefinition>>(
        `/packs/resource-views?organizationId=${selectedOrg.id}`,
      )
      .then((res) => {
        const configs = res.data ?? {};
        setViewConfigs(configs);
        // Set active type from URL param or first available type
        const types = Object.keys(configs);
        if (typeParam && configs[typeParam]) {
          setActiveType(typeParam);
        } else if (types.length > 0 && !activeType) {
          setActiveType(types[0]);
        }
      })
      .catch(() => setError('Failed to load resource type configurations'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg]);

  // ── 3. Load resources when type or org changes ────────────────────────────

  const loadResources = useCallback(() => {
    if (!selectedOrg || !activeType) return;
    setLoading(true);
    setError(null);
    apiClient
      .get<Resource[]>(
        `/resources?organizationId=${selectedOrg.id}&type=${activeType}` +
        (stateFilter ? `&state=${stateFilter}` : ''),
      )
      .then((res) => setResources(res.data ?? []))
      .catch(() => setError('Failed to load resources'))
      .finally(() => setLoading(false));
  }, [selectedOrg, activeType, stateFilter]);

  useEffect(() => { loadResources(); }, [loadResources]);

  // ── Tab change: update URL + state ────────────────────────────────────────

  const handleTypeChange = (type: string) => {
    setActiveType(type);
    setStateFilter('');
    setSearch('');
    router.push(`/resources?type=${type}`);
  };

  // ── Inline action handler ─────────────────────────────────────────────────

  const handleAction = (resource: Resource, action: ResourceInlineAction) => {
    if (action.node !== 'state.change') {
      // Non-state.change: open WorkflowActionModal for input collection
      setNodeActionTarget({ resource, action });
      return;
    }
    if (action.requiresConfirm) {
      setConfirmTarget({ resource, action });
    } else {
      executeAction(resource, action);
    }
  };

  const executeAction = async (resource: Resource, action: ResourceInlineAction) => {
    if (!selectedOrg) return;
    setActionBusy(resource.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      if (action.node === 'state.change') {
        // Map label → target state for state.change transitions
        const STATE_MAP: Record<string, string> = {
          'Approve':             'active',
          'Reject':              'cancelled',
          'Mark Complete':       'completed',
          'Submit for Approval': 'pending_approval',
          'Cancel':              'cancelled',
          'Activate':            'active',
        };
        const toState = STATE_MAP[action.label] ?? action.label.toLowerCase().replace(/\s+/g, '_');
        await apiClient.post(
          `/resources/${resource.id}/transition?organizationId=${selectedOrg.id}`,
          { toState },
        );
        setActionSuccess(`${resource.name} → ${toState.replace(/_/g, ' ')}`);
      }
      loadResources();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionBusy(null);
      setConfirmTarget(null);
    }
  };

  // ── Filter resources client-side ──────────────────────────────────────────

  const filtered = resources.filter((r) => {
    if (!search) return true;
    return r.name.toLowerCase().includes(search.toLowerCase());
  });

  // ── Derived ───────────────────────────────────────────────────────────────

  const typeList      = Object.values(viewConfigs);
  const activeConfig  = viewConfigs[activeType];
  const uniqueStates  = [...new Set(resources.map((r) => r.state))].sort();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Page header ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Resources</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {activeConfig
                ? `${activeConfig.displayNamePlural ?? activeConfig.displayName} managed by ${activeConfig.packId}`
                : 'All resource types across installed packs'}
            </p>
          </div>

          {/* Org selector */}
          {orgs.length > 1 && (
            <select
              value={selectedOrg?.id ?? ''}
              onChange={(e) => {
                const org = orgs.find((o) => o.id === e.target.value);
                if (org) setSelectedOrg(org);
              }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── Type tabs (horizontal scroll on mobile) ── */}
      {typeList.length > 0 && (
        <div className="bg-white border-b border-gray-200 overflow-x-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-end gap-0">
            {typeList.map((def) => {
              const isActive = def.type === activeType;
              return (
                <button
                  key={def.type}
                  onClick={() => handleTypeChange(def.type)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
                  }`}
                >
                  {def.icon && <span>{def.icon}</span>}
                  {def.displayNamePlural ?? def.displayName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">

        {/* ── Filters row ── */}
        <div className="mb-5 flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <input
            type="text"
            placeholder={`Search ${activeConfig?.displayNamePlural ?? 'resources'}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* State filter */}
          {uniqueStates.length > 1 && (
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All states</option>
              {uniqueStates.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          )}

          {/* Refresh */}
          <button
            onClick={loadResources}
            disabled={loading}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>⟳</span>
          </button>
        </div>

        {/* ── Toasts ── */}
        {actionSuccess && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700 flex items-center justify-between">
            ✅ {actionSuccess}
            <button onClick={() => setActionSuccess(null)} className="text-green-400 hover:text-green-600 ml-4">✕</button>
          </div>
        )}
        {actionError && (
          <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700 flex items-center justify-between">
            {actionError}
            <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 ml-4">✕</button>
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700 flex items-center justify-between">
            {error}
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4">✕</button>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="text-center py-16 text-sm text-gray-400">
            Loading {activeConfig?.displayNamePlural ?? 'resources'}…
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && filtered.length === 0 && !error && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">{activeConfig?.icon ?? '🗂️'}</div>
            <p className="text-sm text-gray-500">
              No {activeConfig?.displayNamePlural ?? 'resources'} found
              {(search || stateFilter) ? ' matching your filters' : ''}.
            </p>
            {(search || stateFilter) && (
              <button
                onClick={() => { setSearch(''); setStateFilter(''); }}
                className="mt-3 text-sm text-blue-600 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* ── Resource grid ── */}
        {!loading && filtered.length > 0 && (
          <>
            <p className="text-xs text-gray-400 mb-4">
              <span className="font-semibold text-gray-600">{filtered.length}</span> of{' '}
              <span className="font-semibold text-gray-600">{resources.length}</span>{' '}
              {activeConfig?.displayNamePlural ?? 'resources'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  viewConfig={activeConfig}
                  orgId={selectedOrg?.id ?? ''}
                  onAction={handleAction}
                  actionBusy={actionBusy}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Empty state: no type selected ── */}
        {!loading && typeList.length === 0 && !error && (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-sm text-gray-500">No packs with resource types are currently active.</p>
            <a href="/packs" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
              Go to Packs →
            </a>
          </div>
        )}
      </div>

      {/* ── Confirm modal (state.change with requiresConfirm) ── */}
      {confirmTarget && (
        <ConfirmModal
          action={confirmTarget.action}
          resource={confirmTarget.resource}
          onConfirm={() => executeAction(confirmTarget.resource, confirmTarget.action)}
          onCancel={() => setConfirmTarget(null)}
          busy={actionBusy === confirmTarget.resource.id}
        />
      )}

      {/* ── Workflow action modal (non-state.change pack nodes) ── */}
      {nodeActionTarget && (
        <WorkflowActionModal
          action={nodeActionTarget.action}
          resource={nodeActionTarget.resource}
          packId={activeConfig?.packId ?? ''}
          orgId={selectedOrg?.id ?? ''}
          onSuccess={(msg) => {
            setNodeActionTarget(null);
            setActionSuccess(msg);
            loadResources();
          }}
          onCancel={() => setNodeActionTarget(null)}
        />
      )}
    </div>
  );
}

// Wrap in Suspense for useSearchParams requirement in Next.js 14
export default function ResourcesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">
        Loading…
      </div>
    }>
      <ResourcesPageInner />
    </Suspense>
  );
}
