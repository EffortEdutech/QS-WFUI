'use client';

/**
 * Marketplace - Phase 18 External Registry
 *
 * Tabs:
 * - Installed: local compiled/installed packs, enable/disable management.
 * - Browse Registry: verified external pack listings, install to local catalogue.
 * - Data Packs: governed datasets, install state, item preview, and provenance.
 * - Publish Pack: submit .ladosPack bundles for verification.
 * - Review Queue: owner/admin review gate for pending registry submissions.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';

interface Organization {
  id: string;
  name?: string;
  membership?: { role?: string };
}

interface Pack {
  id: string;
  display_name: string;
  description: string | null;
  author: string;
  version: string;
  icon: string | null;
  color: string | null;
  is_official: boolean;
  is_enabled: boolean;
  status: 'active' | 'disabled' | 'error';
  node_count: number;
  dependencies: string[];
}

interface RegistryNodeManifest {
  type: string;
  name?: string;
  description?: string;
  category?: string;
}

interface RegistryManifest {
  id: string;
  displayName?: string;
  display_name?: string;
  version: string;
  author?: string;
  dependencies?: string[];
  nodes: RegistryNodeManifest[];
}

interface RegistryPack {
  id: string;
  packId: string;
  displayName: string;
  description: string | null;
  author: string;
  version: string;
  tags: string[];
  icon: string | null;
  color: string | null;
  isOfficial: boolean;
  isVerified: boolean;
  downloads: number;
  checksum: string;
  manifest: RegistryManifest;
  createdAt: string;
  verifiedAt: string | null;
}

interface DataPackSummary {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  version: string;
  publisher: string;
  region: string | null;
  domain: string | null;
  category: string | null;
  isOfficial: boolean;
  status: string;
  icon: string | null;
  installed: boolean;
  installStatus: string | null;
  installedAt: string | null;
  installedVersion?: DataPackVersion | null;
  latestVersion?: DataPackVersion | null;
  collections?: DataPackCollection[];
}

interface DataPackVersion {
  id: string;
  version: string;
  sourceSummary: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  region: string | null;
  currency: string | null;
  unitSystem: string | null;
  checksum: string | null;
  publishedAt: string;
}

interface DataPackCollection {
  id: string;
  key: string;
  displayName: string;
  description: string | null;
  itemCount: number;
}

interface DataPackItem {
  id: string;
  itemKey: string;
  title: string;
  description: string | null;
  unit: string | null;
  tags: string[];
  sourceName: string;
  sourceDate: string | null;
  region: string | null;
  classification: string | null;
  applicabilityNotes: string | null;
  assumptions: string | null;
  advisoryStatus: string;
}

interface DataPackVersionDetail {
  pack: DataPackSummary;
  version: DataPackVersion;
  collections: Array<DataPackCollection & { items: DataPackItem[] }>;
}

type Tab = 'installed' | 'registry' | 'data' | 'publish' | 'review';

const tabs: { id: Tab; label: string }[] = [
  { id: 'installed', label: 'Installed' },
  { id: 'registry', label: 'Browse Registry' },
  { id: 'data', label: 'Data Packs' },
  { id: 'publish', label: 'Publish Pack' },
  { id: 'review', label: 'Review Queue' },
];

function roleCanManage(role?: string): boolean {
  return role === 'owner' || role === 'admin';
}

function colorStyle(color: string | null): React.CSSProperties {
  return {
    borderColor: color ? `${color}55` : undefined,
  };
}

function PackBadge({ children, tone = 'gray' }: { children: string; tone?: 'gray' | 'blue' | 'green' | 'amber' }) {
  const classes = {
    gray: 'border-gray-200 bg-gray-50 text-gray-600',
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${classes[tone]}`}>
      {children}
    </span>
  );
}

function InstalledPackCard({
  pack,
  onToggle,
  busy,
}: {
  pack: Pack;
  onToggle: (pack: Pack) => void;
  busy: boolean;
}) {
  const isActive = pack.is_enabled && pack.status !== 'disabled';

  return (
    <article className="rounded-lg border bg-white p-4 shadow-sm" style={colorStyle(pack.color)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/packs/${encodeURIComponent(pack.id)}`} className="text-sm font-semibold text-gray-900 hover:text-blue-700">
            {pack.display_name}
          </Link>
          <p className="mt-0.5 truncate text-[11px] font-mono text-gray-400">{pack.id} / v{pack.version}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {pack.is_official && <PackBadge tone="blue">Official</PackBadge>}
          <PackBadge tone={isActive ? 'green' : 'gray'}>{isActive ? 'Active' : 'Disabled'}</PackBadge>
        </div>
      </div>

      {pack.description && (
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-gray-500">{pack.description}</p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-[11px] text-gray-500">
          <span className="font-semibold text-gray-700">{pack.node_count}</span> nodes
        </span>
        <button
          type="button"
          onClick={() => onToggle(pack)}
          disabled={busy}
          className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
            isActive
              ? 'border-gray-200 text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          {busy ? 'Working...' : isActive ? 'Disable' : 'Enable'}
        </button>
      </div>
    </article>
  );
}

function RegistryPackCard({
  pack,
  installed,
  onPreview,
  onInstall,
  busy,
  canInstall,
}: {
  pack: RegistryPack;
  installed: boolean;
  onPreview: (pack: RegistryPack) => void;
  onInstall: (pack: RegistryPack) => void;
  busy: boolean;
  canInstall: boolean;
}) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm" style={colorStyle(pack.color)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-gray-900">{pack.displayName}</h2>
          <p className="mt-0.5 truncate text-[11px] font-mono text-gray-400">{pack.packId} / v{pack.version}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {pack.isOfficial && <PackBadge tone="blue">Official</PackBadge>}
          {pack.isVerified ? <PackBadge tone="green">Verified</PackBadge> : <PackBadge tone="amber">Review</PackBadge>}
        </div>
      </div>

      {pack.description && (
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-gray-500">{pack.description}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {pack.tags.slice(0, 4).map((tag) => (
          <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-[11px] text-gray-500">
        <span><b className="text-gray-700">{pack.manifest.nodes.length}</b> nodes</span>
        <span><b className="text-gray-700">{pack.downloads}</b> installs</span>
        <span className="truncate" title={pack.author}>{pack.author}</span>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onPreview(pack)}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
        >
          Preview
        </button>
        <button
          type="button"
          onClick={() => onInstall(pack)}
          disabled={busy || installed || !canInstall}
          className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Installing...' : installed ? 'Installed' : 'Install'}
        </button>
      </div>
    </article>
  );
}

function ReviewPackCard({
  pack,
  onPreview,
  onApprove,
  busy,
}: {
  pack: RegistryPack;
  onPreview: (pack: RegistryPack) => void;
  onApprove: (pack: RegistryPack) => void;
  busy: boolean;
}) {
  return (
    <article className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm" style={colorStyle(pack.color)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-gray-900">{pack.displayName}</h2>
          <p className="mt-0.5 truncate text-[11px] font-mono text-gray-400">{pack.packId} / v{pack.version}</p>
        </div>
        <PackBadge tone="amber">Pending</PackBadge>
      </div>

      {pack.description && (
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-gray-500">{pack.description}</p>
      )}

      <div className="mt-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Listing ID</p>
        <p className="mt-1 break-all font-mono text-[11px] text-gray-600">{pack.id}</p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-[11px] text-gray-500">
        <span><b className="text-gray-700">{pack.manifest.nodes.length}</b> nodes</span>
        <span className="truncate" title={pack.author}>{pack.author}</span>
        <span>{new Date(pack.createdAt).toLocaleDateString()}</span>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onPreview(pack)}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
        >
          Preview
        </button>
        <button
          type="button"
          onClick={() => onApprove(pack)}
          disabled={busy}
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Approving...' : 'Approve'}
        </button>
      </div>
    </article>
  );
}

function DataPackCard({
  pack,
  onDetail,
  onInstall,
  onUninstall,
  busy,
  canManage,
}: {
  pack: DataPackSummary;
  onDetail: (pack: DataPackSummary) => void;
  onInstall: (pack: DataPackSummary) => void;
  onUninstall: (pack: DataPackSummary) => void;
  busy: boolean;
  canManage: boolean;
}) {
  const version = pack.installedVersion ?? pack.latestVersion;

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">{pack.displayName}</h2>
          <p className="mt-0.5 truncate text-[11px] font-mono text-gray-400">{pack.slug}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {pack.isOfficial && <PackBadge tone="blue">Official</PackBadge>}
          <PackBadge tone={pack.installed ? 'green' : 'gray'}>{pack.installed ? 'Installed' : 'Available'}</PackBadge>
        </div>
      </div>

      <p className="mt-3 line-clamp-3 text-xs leading-5 text-gray-500">{pack.description ?? 'No description provided.'}</p>

      <div className="mt-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Version and provenance</p>
        <p className="mt-1 text-xs leading-5 text-gray-600">
          v{version?.version ?? pack.version} · {pack.region ?? 'Global'} · {version?.sourceSummary ?? 'Source-aware governed dataset.'}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {pack.category && (
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            {pack.category}
          </span>
        )}
        {pack.domain && (
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
            {pack.domain}
          </span>
        )}
        {(pack.collections ?? []).slice(0, 3).map((collection) => (
          <span key={collection.key} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
            {collection.key}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={() => onDetail(pack)}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
        >
          Detail
        </button>
        {pack.installed ? (
          <button
            type="button"
            onClick={() => onUninstall(pack)}
            disabled={busy || !canManage}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Working...' : 'Disable'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onInstall(pack)}
            disabled={busy || !canManage}
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Installing...' : 'Install'}
          </button>
        )}
      </div>
    </article>
  );
}

function PreviewModal({ pack, onClose }: { pack: RegistryPack; onClose: () => void }) {
  const nodes = pack.manifest.nodes.slice(0, 50);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[82vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900">{pack.displayName}</h2>
              <p className="mt-0.5 truncate text-xs font-mono text-gray-400">{pack.packId} / v{pack.version}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="max-h-[64vh] overflow-y-auto px-5 py-4">
          <p className="text-sm leading-6 text-gray-600">
            {pack.description ?? 'No description provided.'}
          </p>

          <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            Registry install currently registers metadata and node declarations only. Uploaded runtime code is not executed until Lados has the sandboxed verifier phase.
          </div>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Nodes ({pack.manifest.nodes.length})
          </h3>
          <div className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {nodes.map((node) => (
              <div key={node.type} className="px-3 py-2">
                <p className="text-xs font-semibold text-gray-800">{node.name ?? node.type}</p>
                <p className="mt-0.5 text-[11px] font-mono text-gray-400">{node.type}</p>
                {node.description && <p className="mt-1 text-xs text-gray-500">{node.description}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DataPackDetailModal({
  detail,
  onClose,
}: {
  detail: DataPackVersionDetail;
  onClose: () => void;
}) {
  const firstItems = detail.collections.flatMap((collection) => collection.items.slice(0, 4)).slice(0, 12);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[84vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900">{detail.pack.displayName}</h2>
              <p className="mt-0.5 truncate text-xs font-mono text-gray-400">
                {detail.pack.slug} / v{detail.version.version}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="max-h-[66vh] overflow-y-auto px-5 py-4">
          <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            Data Pack values are references until accepted by a human user or confirmed by the project contract.
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="font-semibold text-gray-500">Region</p>
              <p className="mt-1 text-gray-800">{detail.version.region ?? detail.pack.region ?? 'Global'}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="font-semibold text-gray-500">Currency</p>
              <p className="mt-1 text-gray-800">{detail.version.currency ?? 'N/A'}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="font-semibold text-gray-500">Effective From</p>
              <p className="mt-1 text-gray-800">{detail.version.effectiveFrom ?? 'N/A'}</p>
            </div>
          </div>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Collections
          </h3>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            {detail.collections.map((collection) => (
              <div key={collection.id} className="rounded-lg border border-gray-200 px-3 py-2">
                <p className="text-xs font-semibold text-gray-800">{collection.displayName}</p>
                <p className="mt-0.5 font-mono text-[11px] text-gray-400">{collection.key}</p>
                <p className="mt-1 text-xs text-gray-500">{collection.itemCount} items</p>
              </div>
            ))}
          </div>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Sample Items and Provenance
          </h3>
          <div className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {firstItems.map((item) => (
              <div key={item.id} className="px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800">{item.title}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-gray-400">{item.itemKey}</p>
                  </div>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                    {item.classification ?? item.advisoryStatus}
                  </span>
                </div>
                {item.description && <p className="mt-1 text-xs leading-5 text-gray-500">{item.description}</p>}
                <p className="mt-2 text-[11px] leading-5 text-gray-500">
                  Source: <span className="font-semibold text-gray-700">{item.sourceName}</span>
                  {item.sourceDate ? ` · ${item.sourceDate}` : ''}
                  {item.region ? ` · ${item.region}` : ''}
                  {item.unit ? ` · ${item.unit}` : ''}
                </p>
                {item.assumptions && <p className="mt-1 text-[11px] leading-5 text-amber-700">{item.assumptions}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const [tab, setTab] = useState<Tab>('installed');
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [packs, setPacks] = useState<Pack[]>([]);
  const [registryPacks, setRegistryPacks] = useState<RegistryPack[]>([]);
  const [reviewPacks, setReviewPacks] = useState<RegistryPack[]>([]);
  const [dataPacks, setDataPacks] = useState<DataPackSummary[]>([]);
  const [installedDataPacks, setInstalledDataPacks] = useState<DataPackSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [dataPackLoading, setDataPackLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<RegistryPack | null>(null);
  const [dataPackPreview, setDataPackPreview] = useState<DataPackVersionDetail | null>(null);
  const [bundleFile, setBundleFile] = useState<File | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    listingId: string;
    packId: string;
    version: string;
    status: string;
  } | null>(null);

  const selectedOrg = orgs.find((org) => org.id === selectedOrgId);
  const canManage = roleCanManage(selectedOrg?.membership?.role);
  const installedPackIds = useMemo(() => new Set(packs.map((pack) => pack.id)), [packs]);
  const activePacks = packs.filter((pack) => pack.is_enabled && pack.status !== 'disabled');
  const disabledPacks = packs.filter((pack) => !pack.is_enabled || pack.status === 'disabled');
  const installedDataPackSlugs = useMemo(
    () => new Set(installedDataPacks.map((pack) => pack.slug)),
    [installedDataPacks],
  );

  const loadOrganizations = useCallback(async () => {
    const res = await apiClient.get<Organization[]>('/organizations');
    if (!res.success) {
      setError(res.error?.message ?? 'Failed to load organizations');
      return;
    }
    const data = res.data ?? [];
    setOrgs(data);
    setSelectedOrgId((current) => current || data[0]?.id || '');
  }, []);

  const loadPacks = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.get<Pack[]>('/marketplace/packs');
    if (res.success) {
      setPacks(res.data ?? []);
      setError(null);
    } else {
      setError(res.error?.message ?? 'Failed to load packs');
    }
    setLoading(false);
  }, []);

  const loadRegistry = useCallback(async () => {
    setRegistryLoading(true);
    const params = new URLSearchParams({ verified: 'true' });
    if (search.trim()) params.set('q', search.trim());
    const res = await apiClient.get<RegistryPack[]>(`/registry/packs?${params.toString()}`);
    if (res.success) {
      setRegistryPacks(res.data ?? []);
      setError(null);
    } else {
      setError(res.error?.message ?? 'Failed to load registry packs');
    }
    setRegistryLoading(false);
  }, [search]);

  const loadReviewQueue = useCallback(async () => {
    if (!canManage) return;
    setReviewLoading(true);
    const res = await apiClient.get<RegistryPack[]>('/registry/packs?verified=false&pageSize=50');
    if (res.success) {
      setReviewPacks((res.data ?? []).filter((pack) => !pack.isVerified));
      setError(null);
    } else {
      setError(res.error?.message ?? 'Failed to load review queue');
    }
    setReviewLoading(false);
  }, [canManage]);

  const loadDataPacks = useCallback(async () => {
    setDataPackLoading(true);
    const suffix = selectedOrgId ? `?organizationId=${encodeURIComponent(selectedOrgId)}` : '';
    const [allRes, installedRes] = await Promise.all([
      apiClient.get<DataPackSummary[]>(`/data-packs${suffix}`),
      selectedOrgId
        ? apiClient.get<DataPackSummary[]>(`/org/data-packs?organizationId=${encodeURIComponent(selectedOrgId)}`)
        : Promise.resolve({ success: true, data: [] as DataPackSummary[], error: null }),
    ]);

    if (allRes.success && installedRes.success) {
      setDataPacks(allRes.data ?? []);
      setInstalledDataPacks(installedRes.data ?? []);
      setError(null);
    } else {
      setError(allRes.error?.message ?? installedRes.error?.message ?? 'Failed to load Data Packs');
    }
    setDataPackLoading(false);
  }, [selectedOrgId]);

  useEffect(() => {
    void loadOrganizations();
    void loadPacks();
  }, [loadOrganizations, loadPacks]);

  useEffect(() => {
    if (tab === 'registry') void loadRegistry();
  }, [loadRegistry, tab]);

  useEffect(() => {
    if (tab === 'review') void loadReviewQueue();
  }, [loadReviewQueue, tab]);

  useEffect(() => {
    if (tab === 'data') void loadDataPacks();
  }, [loadDataPacks, tab]);

  useEffect(() => {
    if (tab === 'review' && !canManage) setTab('installed');
  }, [canManage, tab]);

  const handleToggle = async (pack: Pack) => {
    setBusyId(pack.id);
    setError(null);
    setNotice(null);
    const isActive = pack.is_enabled && pack.status !== 'disabled';
    const suffix = selectedOrgId ? `?organizationId=${encodeURIComponent(selectedOrgId)}` : '';
    const res = isActive
      ? await apiClient.delete(`/marketplace/packs/${encodeURIComponent(pack.id)}${suffix}`)
      : await apiClient.post(`/marketplace/packs/${encodeURIComponent(pack.id)}/install${suffix}`, {});

    if (res.success) {
      setNotice(`${pack.display_name} ${isActive ? 'disabled' : 'enabled'}.`);
      await loadPacks();
    } else {
      setError(res.error?.message ?? `Failed to ${isActive ? 'disable' : 'enable'} ${pack.display_name}`);
    }
    setBusyId(null);
  };

  const installRegistryPack = async (pack: RegistryPack) => {
    if (!selectedOrgId) {
      setError('Select an organization before installing a registry pack.');
      return;
    }
    setBusyId(pack.id);
    setError(null);
    setNotice(null);
    const res = await apiClient.post(
      `/marketplace/registry/${encodeURIComponent(pack.id)}/install?organizationId=${encodeURIComponent(selectedOrgId)}`,
      {},
    );

    if (res.success) {
      setNotice(`${pack.displayName} installed. Its nodes are now visible in the node registry.`);
      await Promise.all([loadPacks(), loadRegistry()]);
    } else {
      setError(res.error?.message ?? `Failed to install ${pack.displayName}`);
    }
    setBusyId(null);
  };

  const approveRegistryPack = async (pack: RegistryPack) => {
    if (!selectedOrgId) {
      setError('Select an organization before approving a registry pack.');
      return;
    }
    setBusyId(pack.id);
    setError(null);
    setNotice(null);
    const res = await apiClient.patch<RegistryPack>(
      `/registry/packs/${encodeURIComponent(pack.id)}/verify?organizationId=${encodeURIComponent(selectedOrgId)}`,
      {
        approved: true,
        note: 'Approved from Marketplace Review Queue',
      },
    );

    if (res.success) {
      setNotice(`${pack.displayName} approved. It is now visible in Browse Registry.`);
      await Promise.all([loadReviewQueue(), loadRegistry()]);
      setTab('registry');
    } else {
      setError(res.error?.message ?? `Failed to approve ${pack.displayName}`);
    }
    setBusyId(null);
  };

  const publishPack = async () => {
    if (!bundleFile) {
      setError('Choose a .ladosPack bundle first.');
      return;
    }

    setPublishBusy(true);
    setError(null);
    setNotice(null);
    setPublishResult(null);
    const form = new FormData();
    form.append('bundle', bundleFile);
    const res = await apiClient.postForm<{
      status: string;
      listing: RegistryPack;
    }>('/registry/packs/submit', form);

    if (res.success) {
      const listing = res.data?.listing;
      if (listing) {
        setPublishResult({
          listingId: listing.id,
          packId: listing.packId,
          version: listing.version,
          status: res.data?.status ?? 'pending_review',
        });
      }
      setNotice(
        res.data?.status === 'already_submitted'
          ? 'This pack version was already submitted. Use the listing id below for verification.'
          : 'Pack submitted for registry verification.',
      );
      setBundleFile(null);
      await loadRegistry();
    } else {
      setError(res.error?.message ?? 'Failed to submit pack');
    }
    setPublishBusy(false);
  };

  const installDataPack = async (pack: DataPackSummary) => {
    if (!selectedOrgId) {
      setError('Select an organization before installing a Data Pack.');
      return;
    }
    setBusyId(pack.slug);
    setError(null);
    setNotice(null);
    const res = await apiClient.post<DataPackSummary>(
      `/data-packs/${encodeURIComponent(pack.slug)}/install?organizationId=${encodeURIComponent(selectedOrgId)}`,
      {},
    );

    if (res.success) {
      setNotice(`${pack.displayName} installed for this organization.`);
      await loadDataPacks();
    } else {
      setError(res.error?.message ?? `Failed to install ${pack.displayName}`);
    }
    setBusyId(null);
  };

  const uninstallDataPack = async (pack: DataPackSummary) => {
    if (!selectedOrgId) {
      setError('Select an organization before disabling a Data Pack.');
      return;
    }
    setBusyId(pack.slug);
    setError(null);
    setNotice(null);
    const res = await apiClient.delete<DataPackSummary>(
      `/data-packs/${encodeURIComponent(pack.slug)}?organizationId=${encodeURIComponent(selectedOrgId)}`,
    );

    if (res.success) {
      setNotice(`${pack.displayName} disabled for this organization.`);
      await loadDataPacks();
    } else {
      setError(res.error?.message ?? `Failed to disable ${pack.displayName}`);
    }
    setBusyId(null);
  };

  const openDataPackDetail = async (pack: DataPackSummary) => {
    setBusyId(pack.slug);
    setError(null);
    const orgSuffix = selectedOrgId ? `?organizationId=${encodeURIComponent(selectedOrgId)}` : '';
    const detailRes = await apiClient.get<DataPackSummary>(`/data-packs/${encodeURIComponent(pack.slug)}${orgSuffix}`);
    if (!detailRes.success || !detailRes.data) {
      setError(detailRes.error?.message ?? `Failed to load ${pack.displayName}`);
      setBusyId(null);
      return;
    }
    const version = detailRes.data.latestVersion?.version ?? detailRes.data.version;
    const versionRes = await apiClient.get<DataPackVersionDetail>(
      `/data-packs/${encodeURIComponent(pack.slug)}/versions/${encodeURIComponent(version)}${orgSuffix}`,
    );
    if (versionRes.success && versionRes.data) {
      setDataPackPreview(versionRes.data);
    } else {
      setError(versionRes.error?.message ?? `Failed to load ${pack.displayName} version detail`);
    }
    setBusyId(null);
  };

  return (
    <>
      {preview && <PreviewModal pack={preview} onClose={() => setPreview(null)} />}
      {dataPackPreview && <DataPackDetailModal detail={dataPackPreview} onClose={() => setDataPackPreview(null)} />}

      <main className="mx-auto max-w-6xl p-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Marketplace</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage installed packs, browse verified external packs, and publish new Lados bundles.
            </p>
          </div>

          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-500">
            Organization
            <select
              value={selectedOrgId}
              onChange={(event) => setSelectedOrgId(event.target.value)}
              className="min-w-56 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-normal text-gray-700 shadow-sm"
            >
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name ?? org.id}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="text-red-500 hover:text-red-700">Dismiss</button>
          </div>
        )}

        {notice && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="text-emerald-600 hover:text-emerald-800">Dismiss</button>
          </div>
        )}

        {!canManage && selectedOrgId && (
          <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            Your current organization role can browse packs, but owner/admin permission is needed to install, enable, or disable packs.
          </div>
        )}

        <nav className="mb-6 flex gap-1 border-b border-gray-200">
          {tabs.filter((item) => item.id !== 'review' || canManage).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                tab === item.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {tab === 'installed' && (
          <div className="space-y-8">
            {loading && <p className="py-8 text-center text-sm text-gray-400">Loading installed packs...</p>}

            {!loading && activePacks.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Active ({activePacks.length})
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {activePacks.map((pack) => (
                    <InstalledPackCard
                      key={pack.id}
                      pack={pack}
                      onToggle={handleToggle}
                      busy={busyId === pack.id || !canManage}
                    />
                  ))}
                </div>
              </section>
            )}

            {!loading && disabledPacks.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Disabled ({disabledPacks.length})
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {disabledPacks.map((pack) => (
                    <InstalledPackCard
                      key={pack.id}
                      pack={pack}
                      onToggle={handleToggle}
                      busy={busyId === pack.id || !canManage}
                    />
                  ))}
                </div>
              </section>
            )}

            {!loading && packs.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                No installed packs found.
              </p>
            )}
          </div>
        )}

        {tab === 'registry' && (
          <div className="space-y-5">
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
              Browse Registry shows verified Capability Packs only. These install node declarations into Lados; uploaded runtime code remains disabled until the sandboxed verifier phase.
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 gap-2">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void loadRegistry();
                  }}
                  placeholder="Search pack name, id, or description"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-400"
                />
                <button
                  type="button"
                  onClick={() => void loadRegistry()}
                  className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Search
                </button>
              </div>
              <button
                type="button"
                onClick={() => void loadRegistry()}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>

            {registryLoading && <p className="py-8 text-center text-sm text-gray-400">Loading registry packs...</p>}

            {!registryLoading && registryPacks.length > 0 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {registryPacks.map((pack) => (
                  <RegistryPackCard
                    key={pack.id}
                    pack={pack}
                    installed={installedPackIds.has(pack.packId)}
                    onPreview={setPreview}
                    onInstall={(item) => void installRegistryPack(item)}
                    busy={busyId === pack.id}
                    canInstall={canManage}
                  />
                ))}
              </div>
            )}

            {!registryLoading && registryPacks.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                No verified registry packs found.
              </p>
            )}
          </div>
        )}

        {tab === 'data' && (
          <div className="space-y-6">
            <section className="rounded-lg border border-emerald-100 bg-emerald-50 px-5 py-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-base font-bold text-emerald-950">Data Packs</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-emerald-800">
                    Data Packs are governed datasets and knowledge packs. They are separate from Capability Packs: they do not execute nodes, but they provide rates, BOQ templates, standards indexes, evidence rules, and reference data that workflows can consume.
                  </p>
                </div>
                <PackBadge tone="green">Phase 19 live</PackBadge>
              </div>
            </section>

            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Organization Data Packs</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Installed datasets available to Explorer, node configs, and workflow execution context.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadDataPacks()}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>

            {dataPackLoading && <p className="py-8 text-center text-sm text-gray-400">Loading Data Packs...</p>}

            {!dataPackLoading && installedDataPacks.length > 0 && (
              <section>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {installedDataPacks.map((pack) => (
                    <DataPackCard
                      key={pack.slug}
                      pack={pack}
                      onDetail={(item) => void openDataPackDetail(item)}
                      onInstall={(item) => void installDataPack(item)}
                      onUninstall={(item) => void uninstallDataPack(item)}
                      busy={busyId === pack.slug}
                      canManage={canManage}
                    />
                  ))}
                </div>
              </section>
            )}

            {!dataPackLoading && installedDataPacks.length === 0 && (
              <section className="rounded-lg border border-dashed border-gray-200 bg-white px-5 py-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">No Data Packs installed yet</h3>
                    <p className="mt-1 text-sm leading-6 text-gray-500">
                      Install an official Data Pack below to make its items searchable in Explorer.
                    </p>
                  </div>
                  <span className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-500">
                    Owner/admin required
                  </span>
                </div>
              </section>
            )}

            <section>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Browse Official Data Packs</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Governed datasets for QS, contractor, construction, and commercial-control workflows.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {dataPacks.map((pack) => (
                  <DataPackCard
                    key={pack.slug}
                    pack={{ ...pack, installed: pack.installed || installedDataPackSlugs.has(pack.slug) }}
                    onDetail={(item) => void openDataPackDetail(item)}
                    onInstall={(item) => void installDataPack(item)}
                    onUninstall={(item) => void uninstallDataPack(item)}
                    busy={busyId === pack.slug}
                    canManage={canManage}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-amber-100 bg-amber-50 px-5 py-4">
              <h3 className="text-sm font-semibold text-amber-950">QS and commercial guardrail</h3>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                Rate, productivity, claim, and standards data must carry source, date, region, unit, assumptions, and advisory status. Data Pack values are references until accepted by a human user or confirmed by the project contract.
              </p>
            </section>
          </div>
        )}

        {tab === 'review' && canManage && (
          <div className="space-y-5">
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              Review Queue shows submitted Capability Packs that are waiting for owner/admin verification. Approval makes the listing visible in Browse Registry. This does not enable uploaded runtime code execution.
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Pending Review ({reviewPacks.length})
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Preview node declarations before approving a submitted bundle.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadReviewQueue()}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>

            {reviewLoading && <p className="py-8 text-center text-sm text-gray-400">Loading review queue...</p>}

            {!reviewLoading && reviewPacks.length > 0 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {reviewPacks.map((pack) => (
                  <ReviewPackCard
                    key={pack.id}
                    pack={pack}
                    onPreview={setPreview}
                    onApprove={(item) => void approveRegistryPack(item)}
                    busy={busyId === pack.id}
                  />
                ))}
              </div>
            )}

            {!reviewLoading && reviewPacks.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                No packs are waiting for review.
              </p>
            )}
          </div>
        )}

        {tab === 'publish' && (
          <section className="max-w-2xl rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-gray-900">Publish Pack</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Submit a .ladosPack bundle for verification. Accepted bundles must contain a manifest.json with pack metadata and node declarations.
            </p>

            <div className="mt-5 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
              Published packs enter review first. Verified registry packs can be installed from Browse Registry, but uploaded runtime code is not executed in this phase.
            </div>

            <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Bundle file
              <input
                type="file"
                accept=".ladosPack,application/zip,application/octet-stream"
                onChange={(event) => setBundleFile(event.target.files?.[0] ?? null)}
                className="mt-2 block w-full rounded-md border border-gray-200 px-3 py-2 text-sm font-normal text-gray-700"
              />
            </label>

            <div className="mt-5 flex items-center justify-between">
              <span className="truncate text-xs text-gray-500">
                {bundleFile ? bundleFile.name : 'No file selected'}
              </span>
              <button
                type="button"
                onClick={() => void publishPack()}
                disabled={publishBusy || !bundleFile}
                className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {publishBusy ? 'Submitting...' : 'Submit for Review'}
              </button>
            </div>

            {publishResult && (
              <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="text-sm font-semibold text-emerald-900">
                  {publishResult.status === 'already_submitted' ? 'Already submitted' : 'Submitted for review'}
                </p>
                <dl className="mt-2 grid grid-cols-1 gap-2 text-xs text-emerald-800 sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold">Listing ID</dt>
                    <dd className="mt-0.5 break-all font-mono">{publishResult.listingId}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Pack</dt>
                    <dd className="mt-0.5 font-mono">{publishResult.packId} / v{publishResult.version}</dd>
                  </div>
                </dl>
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}
