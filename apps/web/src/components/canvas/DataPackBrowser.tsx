'use client';

/**
 * DataPackBrowser — left-panel tab for browsing and installing Data Packs.
 *
 * V3: Data Packs are trusted installable datasets that skills declare as
 * dependencies (via `data_pack_deps`). This browser lets users see what
 * packs are available and which are installed for their organisation.
 *
 * Sprint 13: STUB — shows catalogue from static data; install/uninstall
 *            UI scaffolded but wired to real API in Sprint 15 (Marketplace).
 *
 * See: Vol 12 — Data Pack Specification
 */

// ── Static catalogue (mirrors 0014 migration seed) ────────────────────────────
// Replaced by a live GET /data-packs call in Sprint 15.

interface DataPackEntry {
  slug: string;
  display_name: string;
  description: string;
  region: string | null;
  icon: string;
  is_official: boolean;
}

const CATALOGUE: DataPackEntry[] = [
  {
    slug: 'price-intelligence',
    display_name: 'Price Intelligence',
    description: 'Live & historical market pricing for materials, labour, and equipment in Malaysia.',
    region: 'MY',
    icon: '📊',
    is_official: true,
  },
  {
    slug: 'supplier-my',
    display_name: 'Supplier Directory — Malaysia',
    description: 'Vetted supplier database with contact, accreditation, and performance data.',
    region: 'MY',
    icon: '🏭',
    is_official: true,
  },
  {
    slug: 'material-catalogue',
    display_name: 'Material Catalogue',
    description: 'Standardised material specs, dimensions, grades, and compliance references.',
    region: 'MY',
    icon: '🧱',
    is_official: true,
  },
  {
    slug: 'labour-rates-my',
    display_name: 'Labour Rates — Malaysia',
    description: 'Prevailing daily and hourly labour rates by trade (CIDB guidelines).',
    region: 'MY',
    icon: '👷',
    is_official: true,
  },
  {
    slug: 'cost-index-my',
    display_name: 'Construction Cost Index',
    description: 'Regional cost escalation indices — Klang Valley, Penang, Sabah, Sarawak.',
    region: 'MY',
    icon: '📈',
    is_official: true,
  },
  {
    slug: 'contract-templates-my',
    display_name: 'Contract Templates — Malaysia',
    description: 'Standard forms: PAM 2018, JKR203A, CIDB 2000, NEC4. Pre-tagged for extraction.',
    region: 'MY',
    icon: '📑',
    is_official: true,
  },
  {
    slug: 'smm-standards',
    display_name: 'SMM & Measurement Standards',
    description: 'Standard Method of Measurement rules, preambles, and work section definitions.',
    region: null,
    icon: '📐',
    is_official: true,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function DataPackBrowser() {
  return (
    <aside className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="p-3 border-b border-gray-100 flex-shrink-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Data Packs
        </p>
        <p className="mt-0.5 text-[10px] text-gray-400 leading-snug">
          Trusted datasets your skills can query at runtime.
        </p>
      </div>

      {/* Coming soon banner */}
      <div className="mx-3 mt-3 flex-shrink-0 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-700 leading-snug">
        <span className="font-semibold">Sprint 15 — Marketplace</span>
        <br />
        Install / uninstall and live API are coming soon. The catalogue below is read-only for now.
      </div>

      {/* Pack list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {CATALOGUE.map((pack) => (
          <div
            key={pack.slug}
            className="rounded border border-gray-200 bg-gray-50 px-3 py-2"
          >
            {/* Name + region */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm flex-shrink-0">{pack.icon}</span>
                <span className="text-xs font-medium text-gray-800 truncate">
                  {pack.display_name}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {pack.region && (
                  <span className="rounded px-1 py-0.5 text-[9px] font-medium bg-blue-50 text-blue-500">
                    {pack.region}
                  </span>
                )}
                {pack.is_official && (
                  <span
                    className="rounded px-1 py-0.5 text-[9px] font-medium bg-green-50 text-green-600"
                    title="Official Lados Data Pack"
                  >
                    ✓ Official
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <p className="mt-1 text-[10px] text-gray-400 leading-snug line-clamp-2">
              {pack.description}
            </p>

            {/* Slug + placeholder install button */}
            <div className="mt-1.5 flex items-center justify-between">
              <span className="font-mono text-[9px] text-gray-300">{pack.slug}</span>
              <button
                disabled
                title="Install / uninstall available in Sprint 15 (Marketplace)"
                className="rounded px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
              >
                Install
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 p-3 border-t border-gray-100">
        <p className="text-[10px] text-gray-300 text-center">
          7 official packs · Marketplace in Sprint 15
        </p>
      </div>
    </aside>
  );
}
