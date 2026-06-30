'use client';

/**
 * Capability Marketplace — /marketplace
 * Phase 8 — Pack Installer + Marketplace UI
 *
 * Two tabs:
 *   • Capability Packs — installed packs (live from /marketplace/packs) + coming-soon stubs
 *   • Data Packs       — coming-soon data pack catalogue
 *
 * Enable/disable packs via POST/DELETE /marketplace/packs/:packId/install.
 * Install Wizard modal appears before enabling a disabled pack.
 *
 * Security reminder: AI is advisory only. This page must never approve,
 * certify, decide entitlement, or impersonate a registered PQS/Sr.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { resolveIcon } from '@/lib/icon-map';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Pack {
  id:           string;
  display_name: string;
  description:  string | null;
  author:       string;
  version:      string;
  icon:         string | null;
  color:        string | null;
  is_official:  boolean;
  is_enabled:   boolean;
  status:       'active' | 'disabled' | 'error';
  node_count:   number;
  dependencies: string[];
}

type Tab = 'capability' | 'data';

// ── Coming-soon stub data ─────────────────────────────────────────────────────

interface ComingSoonPack {
  id:           string;
  display_name: string;
  description:  string;
  author:       string;
  icon:         string;
  color:        string;
  category:     string;
}

const COMING_SOON_CAPABILITY: ComingSoonPack[] = [
  {
    id:           'lados.bq-pack',
    display_name: 'BQ Analytics Pack',
    description:  'Cost plan import, BQ variance analysis, and earned-value metrics for QS workflows.',
    author:       'Lados Team',
    icon:         '📊',
    color:        '#8B5CF6',
    category:     'Analytics',
  },
  {
    id:           'lados.contract-pack',
    display_name: 'Contract Management Pack',
    description:  'JCT/FIDIC clause lookup, variation orders, interim payment certificates.',
    author:       'Lados Team',
    icon:         '📜',
    color:        '#F59E0B',
    category:     'Contract',
  },
  {
    id:           'lados.tender-pack',
    display_name: 'Tender Pack',
    description:  'Tender document generation, bid comparison, shortlisting automation.',
    author:       'Lados Team',
    icon:         '🏷',
    color:        '#10B981',
    category:     'Procurement',
  },
  {
    id:           'lados.reporting-pack',
    display_name: 'Reporting Pack',
    description:  'Monthly valuation summaries, cash-flow forecasts, and board-level dashboards.',
    author:       'Lados Team',
    icon:         '📈',
    color:        '#EF4444',
    category:     'Reporting',
  },
];

const COMING_SOON_DATA: ComingSoonPack[] = [
  {
    id:           'data.cidb-rates',
    display_name: 'CIDB Rate Schedule',
    description:  'Current CIDB construction cost data for Malaysia (quarterly updated).',
    author:       'Lados Team',
    icon:         '🏗',
    color:        '#3B82F6',
    category:     'Cost Data',
  },
  {
    id:           'data.jubm-benchmarks',
    display_name: 'JUBM Cost Benchmarks',
    description:  'JUBM/Arcadis international construction cost benchmarks database.',
    author:       'Lados Team',
    icon:         '🌐',
    color:        '#6366F1',
    category:     'Benchmarks',
  },
  {
    id:           'data.klang-valley-rates',
    display_name: 'Klang Valley Market Rates',
    description:  'Subcontractor and material market rates specific to Klang Valley.',
    author:       'Lados Team',
    icon:         '🏙',
    color:        '#EC4899',
    category:     'Market Data',
  },
  {
    id:           'data.ms-standards',
    display_name: 'Malaysian Standards Library',
    description:  'MS, SIRIM, and relevant IS/BS standards for construction specifications.',
    author:       'Lados Team',
    icon:         '📋',
    color:        '#14B8A6',
    category:     'Standards',
  },
];

// ── Pack icon / colour map ────────────────────────────────────────────────────

const PACK_EMOJI: Record<string, string> = {
  'lados.core-pack':          '⚙️',
  'lados.qs-pack':            '📐',
  'lados.procurement-pack':   '🛒',
  'lados.document-pack':      '📄',
  'lados.ai-pack':            '🤖',
  'lados.foundation-pack':   '🏗️',
  'lados.contractor-pack':   '🚛',
  'lados.construction-pack': '🏗️',
  'lados.finance-pack':      '💰',
  'lados.notifications-pack':'🔔',
};

/** Convert a Lucide icon name string (stored in DB) to an emoji fallback */
const LUCIDE_TO_EMOJI: Record<string, string> = {
  'banknote':      '💰',
  'hard-hat':      '🪖',
  'bell':          '🔔',
  'cpu':           '⚙️',
  'layers':        '🏗️',
  'bar-chart-2':   '📊',
  'file-text':     '📄',
  'shopping-cart': '🛒',
  'truck':         '🚛',
  'bot':           '🤖',
  'package':       '📦',
};

// ── Install Wizard Modal ──────────────────────────────────────────────────────

interface WizardProps {
  pack:       Pack;
  onConfirm:  () => void;
  onCancel:   () => void;
  busy:       boolean;
}

function InstallWizard({ pack, onConfirm, onCancel, busy }: WizardProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div
          className="rounded-t-xl px-6 py-5 flex items-center gap-4"
          style={{ background: pack.color ? `${pack.color}12` : '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}
        >
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ backgroundColor: pack.color ? `${pack.color}22` : '#F3F4F6' }}
          >
            {PACK_EMOJI[pack.id] ?? LUCIDE_TO_EMOJI[pack.icon ?? ''] ?? '📦'}
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">{pack.display_name}</h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{pack.id} · v{pack.version}</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {pack.description && (
            <p className="text-sm text-gray-600">{pack.description}</p>
          )}

          <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Nodes included</span>
              <span className="font-semibold text-gray-700">{pack.node_count}</span>
            </div>
            {pack.dependencies.length > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Dependencies</span>
                <span className="font-semibold text-gray-700">{pack.dependencies.join(', ')}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Publisher</span>
              <span className="font-semibold text-gray-700">
                {pack.author}
                {pack.is_official && (
                  <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] bg-blue-50 text-blue-600 border border-blue-100">
                    Official
                  </span>
                )}
              </span>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Enabling this pack makes its nodes available in the Workflow Builder for all users
            in your platform. You can disable it at any time.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {busy ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Enabling…
              </>
            ) : (
              'Enable Pack'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Installed pack card ───────────────────────────────────────────────────────

interface PackCardProps {
  pack:           Pack;
  onToggle:       (pack: Pack) => void;
  toggling:       boolean;
}

function PackCard({ pack, onToggle, toggling }: PackCardProps) {
  const isActive = pack.is_enabled && pack.status !== 'disabled';

  return (
    <div
      className={`rounded-xl border bg-white p-5 transition-all ${
        isActive
          ? 'border-gray-200 hover:border-blue-200 hover:shadow-sm'
          : 'border-dashed border-gray-200 opacity-70'
      }`}
      style={isActive && pack.color ? { borderColor: `${pack.color}33` } : undefined}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
          style={{ backgroundColor: pack.color ? `${pack.color}22` : '#F3F4F6' }}
        >
          {PACK_EMOJI[pack.id] ?? LUCIDE_TO_EMOJI[pack.icon ?? ''] ?? '📦'}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {pack.is_official && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
              Official
            </span>
          )}
          {isActive ? (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-green-50 text-green-600 border border-green-100">
              ✓ Active
            </span>
          ) : (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">
              Disabled
            </span>
          )}
        </div>
      </div>

      <Link
        href={`/packs/${encodeURIComponent(pack.id)}`}
        className="group block"
      >
        <h2 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
          {pack.display_name}
        </h2>
      </Link>
      <p className="text-[11px] text-gray-400 mt-0.5 font-mono">v{pack.version} · {pack.author}</p>

      {pack.description && (
        <p className="mt-2 text-xs text-gray-500 leading-snug line-clamp-2">{pack.description}</p>
      )}

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-[11px] text-gray-500">
          <span className="font-semibold text-gray-700">{pack.node_count}</span>{' '}
          node{pack.node_count !== 1 ? 's' : ''}
        </span>

        <div className="flex items-center gap-2">
          <Link
            href={`/packs/${encodeURIComponent(pack.id)}`}
            className="text-[11px] font-medium text-blue-500 hover:underline"
          >
            View →
          </Link>
          <button
            onClick={() => onToggle(pack)}
            disabled={toggling}
            className={`rounded px-2.5 py-1 text-[10px] font-medium transition-colors disabled:opacity-50 ${
              isActive
                ? 'border border-gray-200 text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                : 'border border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
            }`}
          >
            {toggling ? '…' : isActive ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Coming-soon card ──────────────────────────────────────────────────────────

function ComingSoonCard({ pack }: { pack: ComingSoonPack }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 opacity-70">
      <div className="flex items-start justify-between mb-3">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
          style={{ backgroundColor: `${pack.color}18` }}
        >
          {resolveIcon(pack.icon) ?? '📦'}
        </div>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-400 border border-gray-200">
          Coming Soon
        </span>
      </div>

      <h2 className="font-semibold text-gray-600 text-sm">{pack.display_name}</h2>
      <p className="text-[11px] text-gray-400 mt-0.5">{pack.author}</p>
      <p className="mt-2 text-xs text-gray-400 leading-snug line-clamp-2">{pack.description}</p>

      <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
        <span
          className="text-[10px] font-medium rounded px-1.5 py-0.5"
          style={{ backgroundColor: `${pack.color}18`, color: pack.color }}
        >
          {pack.category}
        </span>
        <button disabled className="text-[11px] font-medium text-gray-300 cursor-not-allowed">
          Notify me
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [tab,        setTab]        = useState<Tab>('capability');
  const [packs,      setPacks]      = useState<Pack[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [wizard,     setWizard]     = useState<Pack | null>(null);
  const [wizardBusy, setWizardBusy] = useState(false);

  // Load packs from correct endpoint
  const loadPacks = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get<Pack[]>('/marketplace/packs')
      .then((res) => setPacks(res.data ?? []))
      .catch(() => setError('Failed to load packs'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadPacks(); }, [loadPacks]);

  // Enable a pack (via Install Wizard confirmation)
  const handleEnable = async (pack: Pack) => {
    setWizard(pack);
  };

  const confirmEnable = async () => {
    if (!wizard) return;
    setWizardBusy(true);
    try {
      await apiClient.post(`/marketplace/packs/${encodeURIComponent(wizard.id)}/install`, {});
      setWizard(null);
      loadPacks();
    } catch {
      setError(`Failed to enable ${wizard.display_name}`);
      setWizard(null);
    } finally {
      setWizardBusy(false);
    }
  };

  // Disable a pack
  const handleDisable = async (pack: Pack) => {
    setTogglingId(pack.id);
    try {
      await apiClient.delete(`/marketplace/packs/${encodeURIComponent(pack.id)}`);
      loadPacks();
    } catch {
      setError(`Failed to disable ${pack.display_name}`);
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggle = (pack: Pack) => {
    const isActive = pack.is_enabled && pack.status !== 'disabled';
    if (isActive) {
      void handleDisable(pack);
    } else {
      handleEnable(pack);
    }
  };

  const activePacks   = packs.filter((p) => p.is_enabled && p.status !== 'disabled');
  const disabledPacks = packs.filter((p) => !p.is_enabled || p.status === 'disabled');

  return (
    <>
      {/* Install Wizard */}
      {wizard && (
        <InstallWizard
          pack={wizard}
          onConfirm={() => void confirmEnable()}
          onCancel={() => setWizard(null)}
          busy={wizardBusy}
        />
      )}

      <div className="p-6 max-w-5xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Marketplace</h1>
          <p className="mt-1 text-sm text-gray-500">
            Browse and manage Capability Packs and Data Packs for your Lados platform.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700 flex items-center justify-between">
            {error}
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-3">✕</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
          {(
            [
              { id: 'capability', label: 'Capability Packs', icon: '⚙' },
              { id: 'data',       label: 'Data Packs',       icon: '🗄' },
            ] as { id: Tab; label: string; icon: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Capability Packs tab ── */}
        {tab === 'capability' && (
          <div className="space-y-8">

            {/* Loading */}
            {loading && (
              <p className="text-sm text-gray-400 py-6 text-center">Loading packs…</p>
            )}

            {/* Active packs */}
            {!loading && activePacks.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
                  Active ({activePacks.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activePacks.map((p) => (
                    <PackCard
                      key={p.id}
                      pack={p}
                      onToggle={handleToggle}
                      toggling={togglingId === p.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Disabled packs */}
            {!loading && disabledPacks.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
                  Disabled ({disabledPacks.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {disabledPacks.map((p) => (
                    <PackCard
                      key={p.id}
                      pack={p}
                      onToggle={handleToggle}
                      toggling={togglingId === p.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {!loading && packs.length === 0 && (
              <p className="text-sm text-gray-400 italic py-6 text-center">No packs found.</p>
            )}

            {/* Coming soon */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
                Coming Soon
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {COMING_SOON_CAPABILITY.map((p) => (
                  <ComingSoonCard key={p.id} pack={p} />
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ── Data Packs tab ── */}
        {tab === 'data' && (
          <div>
            <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <strong>Data Packs</strong> provide curated cost data, benchmarks, and standards
              libraries that your workflow skills can reference. Full catalogue launching in a future release.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {COMING_SOON_DATA.map((p) => (
                <ComingSoonCard key={p.id} pack={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
