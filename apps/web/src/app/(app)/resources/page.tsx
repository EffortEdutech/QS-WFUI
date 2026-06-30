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
 *
 * M7 — Driver UI:
 *   When the logged-in user has role 'driver' in their org:
 *   - Only the 'trip' tab is shown
 *   - Trips are filtered to those assigned to the driver's own resource
 *   - A driver banner is shown at the top
 *   - No access to financial/invoice/payroll tabs
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';

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
  dispatched:       'bg-yellow-100 text-yellow-700',
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
  orgId: _orgId,
  onAction,
  actionBusy,
  driverMode,
}: {
  resource:    Resource;
  viewConfig?: PackResourceDefinition;
  orgId:       string;
  onAction:    (resource: Resource, action: ResourceInlineAction) => void;
  actionBusy:  string | null;
  driverMode:  boolean;
}) {
  const list    = viewConfig?.views?.list;
  const actions = viewConfig?.views?.inlineActions ?? [];

  const primary:   string        = list ? getField(resource, list.primaryField)   : resource.name;
  const secondary: string | null = list?.secondaryField ? getField(resource, list.secondaryField) : null;
  const badge:     string        = list?.badgeField     ? getField(resource, list.badgeField)     : resource.state;
  const counter:   string | null = list?.counterField   ? getField(resource, list.counterField)   : null;

  const visibleActions = actions.filter((a) => a.visibleInStates.includes(resource.state));
  const isBusy = actionBusy === resource.id;

  // In driver mode show only the primary state-change actions, not financial nodes
  const DRIVER_HIDDEN_NODES = ['contractor.generate_invoice', 'contractor.approve_payroll'];
  const filteredActions = driverMode
    ? visibleActions.filter((a) => !DRIVER_HIDDEN_NODES.includes(a.node))
    : visibleActions;

  return (
    <div className={`rounded-xl border bg-white shadow-sm hover:shadow-md hover:border-blue-200 transition-all ${
      driverMode ? 'border-yellow-200' : 'border-gray-200'
    }`}>
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
        {secondary ? (
          <p className="mt-1 text-xs text-gray-500 truncate pl-7">{secondary}</p>
        ) : null}

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

        {/* Fuel receipt — show AI extracted data if present */}
        {resource.type === 'fuel_receipt' && resource.data?.aiExtracted != null ? (() => {
          type AiEx = { amount?: number|null; liters?: number|null; fuelType?: string; confidence?: number; approvedByHuman?: boolean };
          const ai = resource.data.aiExtracted as AiEx;
          if (ai.amount == null && ai.liters == null) return null;
          return (
            <div className="mt-2 pl-7">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-purple-600 bg-purple-50 rounded px-1.5 py-0.5">🤖 AI extracted</span>
                {ai.amount   != null && <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 rounded px-1.5 py-0.5">MYR {ai.amount.toFixed(2)}</span>}
                {ai.liters   != null && <span className="text-[11px] text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">{ai.liters} L</span>}
                {ai.fuelType          && <span className="text-[11px] text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">{ai.fuelType}</span>}
                {ai.confidence != null && <span className="text-[10px] text-gray-400">{(ai.confidence * 100).toFixed(0)}% conf.</span>}
              </div>
            </div>
          );
        })() : null}

        {/* Driver mode: show load details inline */}
        {driverMode && resource.data && (
          <div className="mt-2 pl-7 space-y-0.5">
            {resource.data.loadType != null ? (
              <p className="text-[11px] text-gray-500">
                Load: <span className="font-medium text-gray-700">
                  {String(resource.data.loadQuantity ?? '')} {String(resource.data.loadUnit ?? '')} {String(resource.data.loadType)}
                </span>
              </p>
            ) : null}
            {resource.data.origin != null ? (
              <p className="text-[11px] text-gray-500">
                {String(resource.data.origin)} → {String(resource.data.destination ?? '—')}
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* Inline actions */}
      {filteredActions.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-2.5 flex flex-wrap gap-2">
          {filteredActions.map((action) => {
            const isStateChange = action.node === 'state.change';
            return (
              <button
                key={action.label}
                onClick={() => onAction(resource, action)}
                disabled={isBusy}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                  driverMode
                    ? 'bg-yellow-50 border border-yellow-300 text-yellow-800 hover:bg-yellow-100'
                    : isStateChange
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
//
// Smart field rendering:
//   - Fields ending in "Id" (vehicleId, driverId, customerId, jobId …)
//     → resource picker dropdown loaded from GET /resources?type={xyz}
//   - Fields named "scheduledDate" or "date" → <input type="date">
//   - Fields named "notes", "description", "remarks" → <textarea>
//   - Everything else → <input type="text|number">
//
// Fields whose key matches the current resource type (e.g. jobId when
// browsing a job) are pre-filled and shown as read-only.

interface NodeInputSchema {
  key:          string;
  label:        string;
  type:         string;
  required?:    boolean;
  description?: string;
}

interface ResourceOption {
  id:    string;
  name:  string;
  state: string;
}

/** Derive the resource type from a field key like "vehicleId" → "vehicle" */
function resourceTypeFromKey(key: string): string | null {
  if (!key.endsWith('Id') || key === 'resourceId') return null;
  return key.slice(0, -2); // strip trailing "Id"
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
  const [schema,          setSchema]          = useState<NodeInputSchema[]>([]);
  const [values,          setValues]          = useState<Record<string, string>>({});
  const [resourceOptions, setResourceOptions] = useState<Record<string, ResourceOption[]>>({});
  const [busy,            setBusy]            = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [result,          setResult]          = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!packId) { setLoading(false); return; }

    apiClient
      .get<{
        nodes: Array<{
          type:    string;
          inputs?: Array<{ name: string; type: string; required?: boolean; description?: string }>;
        }>;
      }>(`/packs/${encodeURIComponent(packId)}`)
      .then(async (res) => {
        const node      = (res.data?.nodes ?? []).find((n) => n.type === action.node);
        const rawInputs = node?.inputs ?? [];

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

        // Pre-fill values: own resource type pre-fills its Id field,
        // and any data fields already on the resource are pre-filled too.
        const pre: Record<string, string> = {};
        for (const f of fields) {
          if (f.key === `${resource.type}Id`) {
            pre[f.key] = resource.id;
          } else if (resource.data?.[f.key] !== undefined) {
            pre[f.key] = String(resource.data[f.key]);
          }
        }
        setValues(pre);

        // For each *Id field (except the current resource's own type),
        // fetch the resource list so we can show a picker dropdown.
        const pickerFetches = fields
          .filter((f) => {
            const rt = resourceTypeFromKey(f.key);
            return rt !== null && rt !== resource.type; // own type is pre-filled / read-only
          })
          .map(async (f) => {
            const rt  = resourceTypeFromKey(f.key)!;
            const r   = await apiClient.get<ResourceOption[]>(
              `/resources?organizationId=${orgId}&type=${rt}`,
            );
            return { key: f.key, options: r.data ?? [] };
          });

        const results = await Promise.allSettled(pickerFetches);
        const opts: Record<string, ResourceOption[]> = {};
        for (const r of results) {
          if (r.status === 'fulfilled') {
            opts[r.value.key] = r.value.options;
          }
        }
        setResourceOptions(opts);
      })
      .catch(() => setSchema([]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId, action.node, orgId]);

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      const inputs: Record<string, unknown> = { ...values };
      inputs['resourceId'] ??= resource.id;

      // apiClient.post<T> returns ApiResponse<T> — T is the inner data payload, not the envelope
      // API shape: ApiResponse<{ status: string; outputs: {...}; error?: unknown }>
      const res = await apiClient.post<{
        status: string;
        outputs: Record<string, unknown>;
        error?: unknown;
      }>(
        `/resources/${resource.id}/execute-action?organizationId=${orgId}`,
        { node: action.node, inputs },
      );

      if (!res.success || res.data?.status === 'failure') {
        const errData = res.data?.error ?? res.error;
        const msg = typeof errData === 'object' && errData !== null && 'message' in errData
          ? String((errData as { message: string }).message)
          : String(errData ?? 'Action failed');
        setError(msg);
      } else {
        // Show the outputs to the user before closing
        setResult(res.data?.outputs ?? {});
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  // ── Field renderer ────────────────────────────────────────────────────────

  function renderField(field: NodeInputSchema) {
    const isOwnRef  = field.key === `${resource.type}Id`;
    const resType   = resourceTypeFromKey(field.key);
    const isDateFld = field.key.toLowerCase().includes('date');
    const isTextarea = ['notes', 'description', 'remarks', 'comment'].includes(field.key.toLowerCase());

    const commonCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50';

    // Pre-filled, read-only: own resource reference
    if (isOwnRef) {
      return (
        <div className={`${commonCls} bg-gray-50 text-gray-500 cursor-default`}>
          {resource.name}
          <span className="ml-2 text-[10px] text-gray-400 font-mono">{resource.id.slice(0, 8)}…</span>
        </div>
      );
    }

    // Resource picker dropdown
    if (resType && field.key in resourceOptions) {
      const options = resourceOptions[field.key];
      return (
        <select
          value={values[field.key] ?? ''}
          onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
          disabled={busy}
          className={commonCls}
        >
          <option value="">— Select {resType} —</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name} ({opt.state})
            </option>
          ))}
        </select>
      );
    }

    // Loading picker options
    if (resType && !(field.key in resourceOptions) && loading === false) {
      return (
        <select disabled className={commonCls}>
          <option>No {resType}s found</option>
        </select>
      );
    }

    // Date field
    if (isDateFld) {
      return (
        <input
          type="date"
          value={values[field.key] ?? ''}
          onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
          disabled={busy}
          className={commonCls}
        />
      );
    }

    // Textarea
    if (isTextarea) {
      return (
        <textarea
          rows={3}
          value={values[field.key] ?? ''}
          onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
          placeholder={`Enter ${field.label.toLowerCase()}…`}
          disabled={busy}
          className={`${commonCls} resize-none`}
        />
      );
    }

    // File / image upload — converts to base64 data URI sent inline with the request
    if (field.type === 'file' || field.type === 'image') {
      const hasFile = !!values[field.key];
      return (
        <div>
          <label className={`flex items-center gap-2 cursor-pointer ${commonCls} ${busy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
            <span className="text-lg">📎</span>
            <span className="text-gray-600">{hasFile ? '✓ Image selected — click to change' : 'Click to choose receipt image…'}</span>
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  setValues((v) => ({ ...v, [field.key]: reader.result as string }));
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>
          {hasFile && (
            <p className="text-[10px] text-green-600 mt-1">Image ready — click Extract Data to process</p>
          )}
        </div>
      );
    }

    // Default: text / number
    return (
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={values[field.key] ?? ''}
        onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
        placeholder={`Enter ${field.label.toLowerCase()}…`}
        disabled={busy}
        className={commonCls}
      />
    );
  }

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

        {/* ── Result panel (shown after success) ── */}
        {result !== null ? (
          <>
            {(() => {
              // Use aiExtracted if present (fuel receipt extraction), else show generic outputs
              type AiEx = { amount?: number|null; liters?: number|null; fuelType?: string; stationName?: string|null; receiptDate?: string|null; vehicleReg?: string|null; confidence?: number; warning?: string; approvedByHuman?: boolean };
              const ai = (result.aiExtracted ?? result) as AiEx;
              const rows: { label: string; value: string; dim?: boolean }[] = [
                { label: 'Amount',      value: ai.amount      != null ? `MYR ${ai.amount.toFixed(2)}` : '—' },
                { label: 'Fuel (L)',    value: ai.liters       != null ? `${ai.liters} L`              : '—' },
                { label: 'Fuel Type',  value: ai.fuelType     ? ai.fuelType                           : '—' },
                { label: 'Station',    value: ai.stationName  ?? '—' },
                { label: 'Date',       value: ai.receiptDate  ?? '—' },
                { label: 'Vehicle',    value: ai.vehicleReg   ?? '—' },
                { label: 'Confidence', value: ai.confidence   != null ? `${(ai.confidence * 100).toFixed(0)}%` : '—' },
              ];
              return (
                <div className="space-y-3 mb-4">
                  <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                    <p className="text-sm font-semibold text-green-800 mb-3">✅ Data extracted</p>
                    <div className="divide-y divide-green-100">
                      {rows.map(r => (
                        <div key={r.label} className="flex justify-between py-1.5 text-xs">
                          <span className="text-gray-500">{r.label}</span>
                          <span className={`font-medium ${r.value === '—' ? 'text-gray-300' : 'text-gray-900'}`}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-700">
                    ⚠️ These values are <strong>advisory only</strong>. Amounts are not posted to finance until an owner/admin approves this receipt.
                  </div>
                  {ai.warning && ai.warning.toLowerCase().includes('low confidence') && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[11px] text-red-700">
                      🔴 {ai.warning}
                    </div>
                  )}
                </div>
              );
            })()}
            <button
              onClick={() => onSuccess(`${action.label} completed for ${resource.name}`)}
              className="w-full rounded-lg bg-gray-900 text-white py-2 text-sm font-medium hover:bg-gray-700"
            >
              Done — view updated receipt card
            </button>
          </>
        ) : (
          <>
            {/* ── Form ── */}
            {loading ? (
              <p className="text-sm text-gray-400 text-center py-8">Loading form…</p>
            ) : (
              <div className="space-y-4">
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
                    {renderField(field)}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                ❌ {error}
              </div>
            )}

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
          </>
        )}
      </div>
    </div>
  );
}

// ── Driver banner ─────────────────────────────────────────────────────────────

function DriverBanner({
  driverName,
  tripCount,
  loading,
}: {
  driverName: string;
  tripCount:  number;
  loading:    boolean;
}) {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 sm:px-6">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚛</span>
          <div>
            <p className="text-sm font-semibold text-yellow-900">
              Selamat datang, {driverName || 'Driver'}
            </p>
            <p className="text-xs text-yellow-700">{today}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-yellow-700">
            {loading ? '—' : tripCount}
          </p>
          <p className="text-[11px] text-yellow-600 font-medium">
            {tripCount === 1 ? 'trip assigned' : 'trips assigned'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Trip step indicator (driver mode) ─────────────────────────────────────────

const TRIP_STEPS: Record<string, { label: string; step: number; total: number }> = {
  dispatched:  { label: 'Dispatched — tap to Start',          step: 1, total: 3 },
  in_progress: { label: 'In Progress — tap to Complete',      step: 2, total: 3 },
  completed:   { label: 'Completed',                          step: 3, total: 3 },
  cancelled:   { label: 'Cancelled',                          step: 0, total: 3 },
};

function TripStepBadge({ state }: { state: string }) {
  const info = TRIP_STEPS[state];
  if (!info || info.step === 0) return null;
  return (
    <div className="mt-2 pl-7 flex items-center gap-1">
      {Array.from({ length: info.total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full ${
            i < info.step ? 'bg-yellow-400' : 'bg-gray-200'
          }`}
        />
      ))}
      <span className="ml-2 text-[10px] text-gray-500 whitespace-nowrap">{info.label}</span>
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

  // ── Driver mode state (M7) ─────────────────────────────────────────────────
  const [isDriverMode,      setIsDriverMode]      = useState(false);
  const [myDriverResId,     setMyDriverResId]     = useState<string | null>(null);
  const [myDriverName,      setMyDriverName]      = useState<string>('');
  const [driverInitialised, setDriverInitialised] = useState(false);

  // ── View config ────────────────────────────────────────────────────────────
  const [viewConfigs, setViewConfigs] = useState<Record<string, PackResourceDefinition>>({});
  const [activeType,  setActiveType]  = useState<string>(typeParam);

  // ── Resource list ──────────────────────────────────────────────────────────
  const [resources,   setResources]   = useState<Resource[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [search,      setSearch]      = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [viewMode,    setViewMode]    = useState<'tile' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('lados_resource_view') as 'tile' | 'table') ?? 'tile';
    }
    return 'tile';
  });

  // ── Action state ───────────────────────────────────────────────────────────
  const [actionBusy,       setActionBusy]       = useState<string | null>(null);
  const [confirmTarget,    setConfirmTarget]    = useState<{
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

  // ── 2. Detect driver mode and find own driver resource ────────────────────

  useEffect(() => {
    if (!selectedOrg) return;

    const role = selectedOrg.membership?.role ?? '';
    if (role !== 'driver') {
      setIsDriverMode(false);
      setDriverInitialised(true);
      return;
    }

    setIsDriverMode(true);

    // Get logged-in user, then find their driver resource by linkedUserId
    async function initDriver() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const res = await apiClient.get<Resource[]>(
          `/resources?organizationId=${selectedOrg!.id}&type=driver`,
        );
        const drivers = res.data ?? [];
        const mine = drivers.find(
          (d) => String(d.data?.linkedUserId ?? '') === user.id,
        );

        if (mine) {
          setMyDriverResId(mine.id);
          setMyDriverName(mine.name);
        }

        // Force trip tab for drivers
        setActiveType('trip');
        router.replace('/resources?type=trip');
      } finally {
        setDriverInitialised(true);
      }
    }

    initDriver();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg]);

  // ── 3. Load pack resource view configs ────────────────────────────────────

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
        // (driver mode will override this in its own effect)
        const types = Object.keys(configs);
        if (!isDriverMode) {
          if (typeParam && configs[typeParam]) {
            setActiveType(typeParam);
          } else if (types.length > 0 && !activeType) {
            setActiveType(types[0]);
          }
        }
      })
      .catch(() => setError('Failed to load resource type configurations'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg]);

  // ── 4. Load resources when type or org changes ────────────────────────────

  const loadResources = useCallback(() => {
    if (!selectedOrg || !activeType) return;
    // In driver mode, wait until driver resource is found before loading trips
    if (isDriverMode && !driverInitialised) return;

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
  }, [selectedOrg, activeType, stateFilter, isDriverMode, driverInitialised]);

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
        const STATE_MAP: Record<string, string> = {
          'Approve':             'active',
          'Reject':              'cancelled',
          'Mark Complete':       'completed',
          'Submit for Approval': 'pending_approval',
          'Cancel':              'cancelled',
          'Activate':            'active',
          'Start Trip':          'in_progress',
          'Complete Trip':       'completed',
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
    // Driver mode: only show trips assigned to this driver
    if (isDriverMode && myDriverResId) {
      if (String(r.data?.driverId ?? '') !== myDriverResId) return false;
    }
    if (!search) return true;
    return r.name.toLowerCase().includes(search.toLowerCase());
  });

  // ── Derived ───────────────────────────────────────────────────────────────

  // In driver mode, only show the 'trip' tab
  const typeList     = isDriverMode
    ? Object.values(viewConfigs).filter((d) => d.type === 'trip')
    : Object.values(viewConfigs);
  const activeConfig  = viewConfigs[activeType];
  const uniqueStates  = [...new Set(resources.map((r) => r.state))].sort();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Driver banner (M7) ── */}
      {isDriverMode && (
        <DriverBanner
          driverName={myDriverName}
          tripCount={filtered.length}
          loading={loading}
        />
      )}

      {/* ── Page header ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isDriverMode ? 'My Trips' : 'Resources'}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {isDriverMode
                ? 'Your assigned trips for today'
                : activeConfig
                  ? `${activeConfig.displayNamePlural ?? activeConfig.displayName} managed by ${activeConfig.packId}`
                  : 'All resource types across installed packs'}
            </p>
          </div>

          {/* Org selector (hide in driver mode — drivers have one org) */}
          {!isDriverMode && orgs.length > 1 && (
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
                      ? isDriverMode
                        ? 'border-yellow-500 text-yellow-700'
                        : 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
                  }`}
                >
                  {def.icon && <span>{def.icon}</span>}
                  {isDriverMode ? 'My Trips' : (def.displayNamePlural ?? def.displayName)}
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
            placeholder={isDriverMode ? 'Search my trips…' : `Search ${activeConfig?.displayNamePlural ?? 'resources'}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* State filter (always show in driver mode for easy filtering) */}
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

          {/* View toggle — hide in driver mode (table not suited for mobile trip workflow) */}
          {!isDriverMode && (
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                title="Tile view"
                onClick={() => { setViewMode('tile'); localStorage.setItem('lados_resource_view', 'tile'); }}
                className={`px-2.5 py-2 text-sm transition-colors ${viewMode === 'tile' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              >
                ⊞
              </button>
              <button
                title="Table view"
                onClick={() => { setViewMode('table'); localStorage.setItem('lados_resource_view', 'table'); }}
                className={`px-2.5 py-2 text-sm transition-colors border-l border-gray-200 ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              >
                ☰
              </button>
            </div>
          )}
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

        {/* ── Driver mode: no resource found warning ── */}
        {isDriverMode && driverInitialised && !myDriverResId && !loading && (
          <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            ⚠️ Your driver profile was not found in this organisation. Contact your admin.
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="text-center py-16 text-sm text-gray-400">
            Loading {isDriverMode ? 'your trips' : (activeConfig?.displayNamePlural ?? 'resources')}…
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && filtered.length === 0 && !error && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">{isDriverMode ? '🚛' : (activeConfig?.icon ?? '🗂️')}</div>
            <p className="text-sm text-gray-500">
              {isDriverMode
                ? 'No trips assigned to you yet.'
                : `No ${activeConfig?.displayNamePlural ?? 'resources'} found${(search || stateFilter) ? ' matching your filters' : ''}.`}
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

        {/* ── Resource grid / table ── */}
        {!loading && filtered.length > 0 && (
          <>
            <p className="text-xs text-gray-400 mb-4">
              <span className="font-semibold text-gray-600">{filtered.length}</span>
              {!isDriverMode && (
                <>
                  {' '}of{' '}
                  <span className="font-semibold text-gray-600">{resources.length}</span>
                  {' '}{activeConfig?.displayNamePlural ?? 'resources'}
                </>
              )}
              {isDriverMode && ' trip(s) assigned to you'}
            </p>

            {/* ── Tile view ── */}
            {(viewMode === 'tile' || isDriverMode) && (
              <div className={`grid gap-4 ${
                isDriverMode
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              }`}>
                {filtered.map((resource) => (
                  <div key={resource.id}>
                    <ResourceCard
                      resource={resource}
                      viewConfig={activeConfig}
                      orgId={selectedOrg?.id ?? ''}
                      onAction={handleAction}
                      actionBusy={actionBusy}
                      driverMode={isDriverMode}
                    />
                    {isDriverMode && <TripStepBadge state={resource.state} />}
                  </div>
                ))}
              </div>
            )}

            {/* ── Table view ── */}
            {viewMode === 'table' && !isDriverMode && (
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">State</th>
                      <th className="px-4 py-3">AI Data</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((resource) => {
                      const ai = resource.type === 'fuel_receipt' && resource.data?.aiExtracted
                        ? (resource.data.aiExtracted as { amount?: number | null; liters?: number | null; confidence?: number | null })
                        : null;

                      const visibleActions = (activeConfig?.views?.inlineActions ?? []).filter(
                        (a: ResourceInlineAction) => a.visibleInStates.includes(resource.state) || a.visibleInStates.includes('*'),
                      );

                      const dateStr = resource.created_at
                        ? new Date(resource.created_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—';

                      return (
                        <tr key={resource.id} className="hover:bg-gray-50/60 transition-colors">
                          {/* Name */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{activeConfig?.icon ?? '🗂️'}</span>
                              <span className="font-medium text-gray-800 leading-tight">{resource.name}</span>
                            </div>
                          </td>

                          {/* Type */}
                          <td className="px-4 py-3">
                            <span className="text-gray-500 capitalize">{resource.type.replace(/_/g, ' ')}</span>
                          </td>

                          {/* State */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              resource.state === 'active'   || resource.state === 'completed' ? 'bg-green-100 text-green-700' :
                              resource.state === 'rejected' || resource.state === 'cancelled' ? 'bg-red-100 text-red-700' :
                              resource.state === 'pending_review' || resource.state === 'pending_approval' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {resource.state.replace(/_/g, ' ')}
                            </span>
                          </td>

                          {/* AI Data */}
                          <td className="px-4 py-3">
                            {ai ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-purple-600 bg-purple-50 rounded px-1.5 py-0.5 font-medium">🤖 AI</span>
                                {ai.amount  != null && <span className="text-xs text-gray-700">MYR {(ai.amount as number).toFixed(2)}</span>}
                                {ai.liters  != null && <span className="text-xs text-gray-500">{ai.liters}L</span>}
                                {ai.confidence != null && (
                                  <span className="text-[10px] text-gray-400">{((ai.confidence as number) * 100).toFixed(0)}%</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>

                          {/* Date */}
                          <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{dateStr}</td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {visibleActions.length === 0 && (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                              {visibleActions.map((action: ResourceInlineAction) => (
                                <button
                                  key={action.label}
                                  onClick={() => handleAction(resource, action)}
                                  disabled={actionBusy === resource.id}
                                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 whitespace-nowrap"
                                >
                                  {action.icon && <span>{action.icon}</span>}
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
