'use client';

/**
 * Platform Services Status page — Sprint 14 (S14-003)
 *
 * Lists all V3 Core Services with their current build status.
 * Data from GET /api/v1/services (migration 0015).
 */

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';

interface CoreService {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'stub' | 'not_built';
  version: string;
  sprint_built?: number;
  sprint_planned?: number;
  icon?: string;
}

const STATUS_CONFIG = {
  active: {
    label: 'Active',
    badge: 'bg-green-100 text-green-700 border border-green-200',
    dot: 'bg-green-500',
  },
  stub: {
    label: 'Stub',
    badge: 'bg-amber-100 text-amber-700 border border-amber-200',
    dot: 'bg-amber-400',
  },
  not_built: {
    label: 'Not Built',
    badge: 'bg-gray-100 text-gray-500 border border-gray-200',
    dot: 'bg-gray-300',
  },
};

export default function ServicesPage() {
  const [services, setServices] = useState<CoreService[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<CoreService[]>('/services')
      .then((res) => setServices(res.data ?? []))
      .catch(() => setError('Failed to load services'))
      .finally(() => setLoading(false));
  }, []);

  const active   = services.filter((s) => s.status === 'active');
  const stub     = services.filter((s) => s.status === 'stub');
  const planned  = services.filter((s) => s.status === 'not_built');

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Platform Services</h1>
        <p className="mt-1 text-sm text-gray-500">
          Core infrastructure services that power Lados skills and workflows.
        </p>
      </div>

      {/* Summary chips */}
      {!loading && !error && (
        <div className="flex gap-3 mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            {active.length} Active
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            {stub.length} Stub
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
            {planned.length} Planned
          </span>
        </div>
      )}

      {loading && (
        <p className="text-sm text-gray-400 py-12 text-center">Loading services…</p>
      )}
      {error && (
        <p className="text-sm text-red-500 py-12 text-center">{error}</p>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {services.map((svc) => {
            const cfg = STATUS_CONFIG[svc.status];
            return (
              <div
                key={svc.id}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
              >
                {/* Icon */}
                <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-xl">
                  {svc.icon ?? '⚙'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{svc.name}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">v{svc.version}</span>
                  </div>
                  {svc.description && (
                    <p className="mt-1 text-xs text-gray-500 leading-relaxed">{svc.description}</p>
                  )}
                  <p className="mt-1.5 text-[10px] font-mono text-gray-300">{svc.id}</p>
                </div>

                {/* Sprint tag */}
                <div className="flex-shrink-0 text-right">
                  {svc.sprint_built !== null && svc.sprint_built !== undefined ? (
                    <span className="text-[10px] text-gray-400">Built Sprint {svc.sprint_built}</span>
                  ) : svc.sprint_planned !== null && svc.sprint_planned !== undefined ? (
                    <span className="text-[10px] text-gray-300">Planned Sprint {svc.sprint_planned}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-[11px] text-gray-300 text-center">
        {services.length} services · Lados Core Engine V1 — Platform Services
      </p>
    </div>
  );
}
