'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';

interface Organization {
  id: string;
  name: string;
  membership: { role: string };
}

interface Project {
  id: string;
  name: string;
  code: string;
  status: string;
  organization_id: string;
}

interface Workflow {
  id: string;
  name: string;
  status: string;
  updated_at: string;
  project_id: string;
}

interface Resource {
  id:         string;
  type:       string;
  name:       string;
  state:      string;
  data:       Record<string, unknown>;
  created_at: string;
}

// ── Contractor KPIs ────────────────────────────────────────────────────────────

interface ContractorKPIs {
  activeJobs:            number;
  activeTrips:           number;
  outstandingInvoices:   number;
  vehiclesInMaintenance: number;
  recentJobs:            Resource[];
}

const OWNER_ROLES = ['owner', 'admin'];

const STATE_COLORS: Record<string, string> = {
  draft:            'bg-gray-100 text-gray-500',
  active:           'bg-green-100 text-green-700',
  pending_approval: 'bg-purple-100 text-purple-700',
  in_progress:      'bg-blue-100 text-blue-700',
  completed:        'bg-teal-100 text-teal-700',
  cancelled:        'bg-red-100 text-red-600',
  pending:          'bg-yellow-100 text-yellow-700',
};

function StateBadge({ state }: { state: string }) {
  const cls = STATE_COLORS[state] ?? 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {state.replace(/_/g, ' ')}
    </span>
  );
}

function KPICard({
  label,
  value,
  icon,
  color,
  href,
  loading,
}: {
  label:   string;
  value:   number;
  icon:    string;
  color:   string;
  href:    string;
  loading: boolean;
}) {
  return (
    <Link href={href} className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-200 hover:shadow-md transition-all block">
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-[10px] font-medium text-gray-400 group-hover:text-blue-500 transition-colors">
          View →
        </span>
      </div>
      <p className={`text-3xl font-bold ${color}`}>
        {loading ? '—' : value}
      </p>
      <p className="mt-1 text-xs font-medium text-gray-500">{label}</p>
    </Link>
  );
}

// ── Contractor Dashboard Section ───────────────────────────────────────────────

function ContractorDashboard({ orgId }: { orgId: string }) {
  const [kpis,    setKpis]    = useState<ContractorKPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;

    async function loadKPIs() {
      try {
        const base = `/resources?organizationId=${orgId}`;

        const [jobsRes, tripsRes, invoicesRes, vehiclesRes] = await Promise.allSettled([
          apiClient.get<Resource[]>(`${base}&type=job&state=active`),
          apiClient.get<Resource[]>(`${base}&type=trip`),
          apiClient.get<Resource[]>(`${base}&type=invoice&state=pending_approval`),
          apiClient.get<Resource[]>(`${base}&type=vehicle&state=maintenance`),
        ]);

        const jobs     = jobsRes.status     === 'fulfilled' ? (jobsRes.value.data     ?? []) : [];
        const trips    = tripsRes.status    === 'fulfilled' ? (tripsRes.value.data    ?? []) : [];
        const invoices = invoicesRes.status === 'fulfilled' ? (invoicesRes.value.data ?? []) : [];
        const vehicles = vehiclesRes.status === 'fulfilled' ? (vehiclesRes.value.data ?? []) : [];

        const activeTrips = trips.filter((t) =>
          t.state === 'in_progress' || t.state === 'pending',
        );

        setKpis({
          activeJobs:            jobs.length,
          activeTrips:           activeTrips.length,
          outstandingInvoices:   invoices.length,
          vehiclesInMaintenance: vehicles.length,
          recentJobs:            jobs.slice(0, 5),
        });
      } finally {
        setLoading(false);
      }
    }

    loadKPIs();
  }, [orgId]);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Contractor Overview</h2>
        <Link href="/resources" className="text-xs text-blue-600 hover:text-blue-700">
          All Resources →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard label="Active Jobs"      value={kpis?.activeJobs ?? 0}            icon="🏗️" color="text-blue-600"   href="/resources?type=job"     loading={loading} />
        <KPICard label="Active Trips"     value={kpis?.activeTrips ?? 0}           icon="🚛" color="text-yellow-600" href="/resources?type=trip"    loading={loading} />
        <KPICard label="Pending Invoices" value={kpis?.outstandingInvoices ?? 0}   icon="🧾" color="text-purple-600" href="/resources?type=invoice" loading={loading} />
        <KPICard label="In Maintenance"   value={kpis?.vehiclesInMaintenance ?? 0} icon="🔧" color="text-orange-500" href="/resources?type=vehicle" loading={loading} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">Active Jobs</h3>
        {loading && <p className="text-xs text-gray-400 py-4 text-center">Loading…</p>}
        {!loading && (kpis?.recentJobs ?? []).length === 0 && (
          <p className="text-xs text-gray-400 py-4 text-center">No active jobs. Create one via Resources.</p>
        )}
        {!loading && (kpis?.recentJobs ?? []).length > 0 && (
          <div className="divide-y divide-gray-50">
            {(kpis?.recentJobs ?? []).map((job) => (
              <div key={job.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{job.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {job.data?.poNumber ? `PO: ${job.data.poNumber}` : `Started ${new Date(job.created_at).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0 flex items-center gap-2">
                  <StateBadge state={job.state} />
                  <Link href="/resources?type=trip" className="text-[10px] text-blue-500 hover:text-blue-700">Trips →</Link>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-gray-50">
          <Link href="/resources?type=job" className="text-xs text-blue-600 hover:text-blue-700">Manage all jobs →</Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { href: '/resources?type=job',     icon: '🏗️', label: 'Jobs'     },
          { href: '/resources?type=trip',    icon: '🚛', label: 'Trips'    },
          { href: '/resources?type=vehicle', icon: '🚗', label: 'Vehicles' },
          { href: '/resources?type=driver',  icon: '👤', label: 'Drivers'  },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <span>{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── M5 — Owner Assistant moved to /ai page (Phase 15) ────────────────────────
// Previously a floating widget here; replaced by the dedicated /ai route to
// avoid button conflict with the global AiCommandBar (workflow trigger).

// ── Main dashboard ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [orgs,            setOrgs]            = useState<Organization[]>([]);
  const [projects,        setProjects]        = useState<Project[]>([]);
  const [recentWorkflows, setRecentWorkflows] = useState<Workflow[]>([]);
  const [loading,         setLoading]         = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const orgRes  = await apiClient.get<Organization[]>('/organizations');
        const orgList = orgRes.data ?? [];
        setOrgs(orgList);

        if (orgList.length === 0) return;

        const org      = orgList[0];
        const projRes  = await apiClient.get<Project[]>(`/organizations/${org.id}/projects`);
        const projList = projRes.data ?? [];
        setProjects(projList);

        if (projList.length > 0) {
          const wfRes = await apiClient.get<Workflow[]>(`/projects/${projList[0].id}/workflows`);
          setRecentWorkflows((wfRes.data ?? []).slice(0, 5));
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const org  = orgs[0];
  const role = org?.membership?.role ?? '';
  const isOwnerAdmin      = OWNER_ROLES.includes(role);
  const isContractorRole  = isOwnerAdmin || role === 'driver';

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          {org && (
            <p className="mt-1 text-sm text-gray-500">
              {org.name} · <span className="capitalize font-medium text-gray-700">{role}</span>
            </p>
          )}
        </div>

        {/* ── Contractor Overview (owner / admin) ── */}
        {!loading && isOwnerAdmin && org && (
          <ContractorDashboard orgId={org.id} />
        )}

        {/* ── Driver quick link ── */}
        {!loading && role === 'driver' && (
          <div className="mb-8 rounded-xl border border-yellow-200 bg-yellow-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-yellow-900">🚛 Driver Portal</p>
                <p className="text-xs text-yellow-700 mt-0.5">View your assigned trips and update their status.</p>
              </div>
              <Link
                href="/resources?type=trip"
                className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-600 transition-colors"
              >
                My Trips →
              </Link>
            </div>
          </div>
        )}

        {/* ── Platform section (non-contractor roles) ── */}
        {!isContractorRole && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm font-medium text-gray-500">Projects</p>
                <p className="mt-2 text-3xl font-bold text-blue-600">
                  {loading ? '—' : projects.length}
                </p>
                <Link href="/projects" className="mt-2 text-xs text-blue-500 hover:text-blue-600 block">View all →</Link>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm font-medium text-gray-500">Workflows</p>
                <p className="mt-2 text-3xl font-bold text-purple-600">
                  {loading ? '—' : recentWorkflows.length}
                </p>
                <p className="mt-2 text-xs text-gray-400">In active project</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm font-medium text-gray-500">Node Library</p>
                <p className="mt-2 text-3xl font-bold text-green-600">12</p>
                <p className="mt-2 text-xs text-gray-400">MVP nodes across 5 packs</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Quick Actions</h2>
                <div className="space-y-2">
                  <Link
                    href="/projects"
                    className="flex items-center gap-3 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <span>📁</span> New Project
                  </Link>
                  {projects.length > 0 && (
                    <Link
                      href={`/projects/${projects[0].id}`}
                      className="flex items-center gap-3 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <span>⚡</span> New Workflow in {projects[0].name}
                    </Link>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Workflows</h2>
                {loading && <p className="text-xs text-gray-400">Loading…</p>}
                {!loading && recentWorkflows.length === 0 && (
                  <p className="text-xs text-gray-400">No workflows yet. Create a project first.</p>
                )}
                <div className="space-y-2">
                  {recentWorkflows.map((wf) => (
                    <Link
                      key={wf.id}
                      href={`/projects/${wf.project_id}/workflows/${wf.id}`}
                      className="flex items-center justify-between py-1.5 hover:text-blue-600 transition-colors"
                    >
                      <span className="text-sm text-gray-700 truncate">{wf.name}</span>
                      <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                        {new Date(wf.updated_at).toLocaleDateString()}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Stack status */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-medium text-green-800">✅ Sprint 1–10 complete — AI Runtime live</p>
          <p className="mt-1 text-xs text-green-600">
            API: http://localhost:4000/api/v1 · Web: http://localhost:3000 · AI assistant available to owner/admin
          </p>
        </div>

      </div>

    </div>
  );
}
