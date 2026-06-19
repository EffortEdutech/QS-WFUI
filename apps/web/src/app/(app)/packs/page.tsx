'use client';

/**
 * Pack Manager — /packs
 * Sprint 15 (S15-001)
 *
 * Lists all installed Capability Packs from the packs table.
 * Each card shows: icon, name, description, version, skill count, official badge.
 * Clicking a card navigates to the Pack Detail page.
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

// ── Pack icon fallbacks ───────────────────────────────────────────────────────

const PACK_EMOJI: Record<string, string> = {
  'qsos.core-pack':        '⚙',
  'qsos.qs-pack':          '📐',
  'qsos.procurement-pack': '🛒',
  'qsos.document-pack':    '📄',
  'qsos.ai-pack':          '🤖',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PacksPage() {
  const [packs, setPacks]   = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<Pack[]>('/nodes/packs')
      .then((res) => setPacks(res.data ?? []))
      .catch(() => setError('Failed to load packs'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Capability Packs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Installed packs available on this platform. Each pack provides a set of skills for your workflows.
        </p>
      </div>

      {/* States */}
      {loading && (
        <div className="text-sm text-gray-400 text-center py-16">Loading packs…</div>
      )}
      {error && (
        <div className="text-sm text-red-500 text-center py-16">{error}</div>
      )}

      {/* Pack grid */}
      {!loading && !error && (
        <>
          <p className="text-xs text-gray-400 mb-4">{packs.length} pack{packs.length !== 1 ? 's' : ''} installed</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {packs.map((pack) => (
              <Link
                key={pack.id}
                href={`/packs/${encodeURIComponent(pack.id)}`}
                className="group block rounded-xl border border-gray-200 bg-white p-5 hover:border-blue-300 hover:shadow-md transition-all"
              >
                {/* Card top: icon + badge */}
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: pack.color ? `${pack.color}22` : '#F3F4F6' }}
                  >
                    <span>{PACK_EMOJI[pack.id] ?? pack.icon ?? '📦'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {pack.is_official && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                        Official
                      </span>
                    )}
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-green-50 text-green-600 border border-green-100">
                      Installed
                    </span>
                  </div>
                </div>

                {/* Name + version */}
                <h2
                  className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors"
                  style={{ color: pack.color ? undefined : undefined }}
                >
                  {pack.display_name}
                </h2>
                <p className="text-[11px] text-gray-400 mt-0.5 font-mono">v{pack.version} · {pack.author}</p>

                {/* Description */}
                {pack.description && (
                  <p className="mt-2 text-xs text-gray-500 leading-snug line-clamp-2">
                    {pack.description}
                  </p>
                )}

                {/* Footer: skill count */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[11px] text-gray-500">
                    <span className="font-semibold text-gray-700">{pack.skill_count}</span> skill{pack.skill_count !== 1 ? 's' : ''}
                  </span>
                  <span
                    className="text-[11px] font-medium group-hover:underline"
                    style={{ color: pack.color ?? '#3B82F6' }}
                  >
                    View details →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
