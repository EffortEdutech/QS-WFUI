'use client';

/**
 * Capability Marketplace — /marketplace
 * Sprint 15 (S15-003)
 *
 * Two tabs:
 *   • Capability Packs — installed packs (live from API) + coming-soon stubs
 *   • Data Packs       — coming-soon data pack catalogue
 *
 * "Coming Soon" packs are display-only; no install action is wired yet.
 *
 * Security reminder: AI is advisory only. This page must never approve,
 * certify, decide entitlement, or impersonate a registered PQS/Sr.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Pack {
  id: string;
  display_name: string;
  description: string | null;
  author: string;
  version: string;
  icon: string | null;
  color: string | null;
  is_official: boolean;
  skill_count: number;
}

type Tab = 'capability' | 'data';

// ── Coming-soon stub data ─────────────────────────────────────────────────────

interface ComingSoonPack {
  id: string;
  display_name: string;
  description: string;
  author: string;
  icon: string;
  color: string;
  category: string;
}

const COMING_SOON_CAPABILITY: ComingSoonPack[] = [
  {
    id: 'qsos.bq-pack',
    display_name: 'BQ Analytics Pack',
    description: 'Cost plan import, BQ variance analysis, and earned-value metrics for QS workflows.',
    author: 'QS-OS Team',
    icon: '📊',
    color: '#8B5CF6',
    category: 'Analytics',
  },
  {
    id: 'qsos.contract-pack',
    display_name: 'Contract Management Pack',
    description: 'JCT/FIDIC clause lookup, variation orders, interim payment certificates.',
    author: 'QS-OS Team',
    icon: '📜',
    color: '#F59E0B',
    category: 'Contract',
  },
  {
    id: 'qsos.tender-pack',
    display_name: 'Tender Pack',
    description: 'Tender document generation, bid comparison, shortlisting automation.',
    author: 'QS-OS Team',
    icon: '🏷',
    color: '#10B981',
    category: 'Procurement',
  },
  {
    id: 'qsos.reporting-pack',
    display_name: 'Reporting Pack',
    description: 'Monthly valuation summaries, cash-flow forecasts, and board-level dashboards.',
    author: 'QS-OS Team',
    icon: '📈',
    color: '#EF4444',
    category: 'Reporting',
  },
];

const COMING_SOON_DATA: ComingSoonPack[] = [
  {
    id: 'data.cidb-rates',
    display_name: 'CIDB Rate Schedule',
    description: 'Current CIDB construction cost data for Malaysia (quarterly updated).',
    author: 'QS-OS Team',
    icon: '🏗',
    color: '#3B82F6',
    category: 'Cost Data',
  },
  {
    id: 'data.jubm-benchmarks',
    display_name: 'JUBM Cost Benchmarks',
    description: 'JUBM/Arcadis international construction cost benchmarks database.',
    author: 'QS-OS Team',
    icon: '🌐',
    color: '#6366F1',
    category: 'Benchmarks',
  },
  {
    id: 'data.klang-valley-rates',
    display_name: 'Klang Valley Market Rates',
    description: 'Subcontractor and material market rates specific to Klang Valley.',
    author: 'QS-OS Team',
    icon: '🏙',
    color: '#EC4899',
    category: 'Market Data',
  },
  {
    id: 'data.ms-standards',
    display_name: 'Malaysian Standards Library',
    description: 'MS, SIRIM, and relevant IS/BS standards for construction specifications.',
    author: 'QS-OS Team',
    icon: '📋',
    color: '#14B8A6',
    category: 'Standards',
  },
];

// ── Pack icon fallbacks ───────────────────────────────────────────────────────

const PACK_EMOJI: Record<string, string> = {
  'qsos.core-pack':        '⚙',
  'qsos.qs-pack':          '📐',
  'qsos.procurement-pack': '🛒',
  'qsos.document-pack':    '📄',
  'qsos.ai-pack':          '🤖',
};

// ── Installed pack card ───────────────────────────────────────────────────────

function InstalledPackCard({ pack }: { pack: Pack }) {
  return (
    <Link
      href={`/packs/${encodeURIComponent(pack.id)}`}
      className="group block rounded-xl border bg-white p-5 hover:border-blue-300 hover:shadow-md transition-all"
      style={{ borderColor: pack.color ? `${pack.color}33` : '#E5E7EB' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
          style={{ backgroundColor: pack.color ? `${pack.color}22` : '#F3F4F6' }}
        >
          {PACK_EMOJI[pack.id] ?? pack.icon ?? '📦'}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {pack.is_official && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
              Official
            </span>
          )}
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-green-50 text-green-600 border border-green-100">
            ✓ Installed
          </span>
        </div>
      </div>

      <h2 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
        {pack.display_name}
      </h2>
      <p className="text-[11px] text-gray-400 mt-0.5 font-mono">v{pack.version} · {pack.author}</p>

      {pack.description && (
        <p className="mt-2 text-xs text-gray-500 leading-snug line-clamp-2">{pack.description}</p>
      )}

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-[11px] text-gray-500">
          <span className="font-semibold text-gray-700">{pack.skill_count}</span> skill{pack.skill_count !== 1 ? 's' : ''}
        </span>
        <span className="text-[11px] font-medium text-blue-500 group-hover:underline">
          View pack →
        </span>
      </div>
    </Link>
  );
}

// ── Coming-soon card ──────────────────────────────────────────────────────────

function ComingSoonCard({ pack }: { pack: ComingSoonPack }) {
  return (
    <div
      className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 opacity-70"
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
          style={{ backgroundColor: `${pack.color}18` }}
        >
          {pack.icon}
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
        <button
          disabled
          className="text-[11px] font-medium text-gray-300 cursor-not-allowed"
        >
          Notify me
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [tab, setTab] = useState<Tab>('capability');
  const [packs, setPacks]   = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<Pack[]>('/nodes/packs')
      .then((res) => setPacks(res.data ?? []))
      .catch(() => setError('Failed to load installed packs'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Marketplace</h1>
        <p className="mt-1 text-sm text-gray-500">
          Browse and manage Capability Packs and Data Packs for your QS-OS platform.
        </p>
      </div>

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
        <div>
          {/* Installed section */}
          <div className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
              Installed
            </h2>

            {loading && (
              <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
            )}
            {error && (
              <p className="text-sm text-red-500 py-6 text-center">{error}</p>
            )}

            {!loading && !error && (
              packs.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No packs installed.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {packs.map((p) => <InstalledPackCard key={p.id} pack={p} />)}
                </div>
              )
            )}
          </div>

          {/* Coming soon section */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
              Coming Soon
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {COMING_SOON_CAPABILITY.map((p) => (
                <ComingSoonCard key={p.id} pack={p} />
              ))}
            </div>
          </div>
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
  );
}
