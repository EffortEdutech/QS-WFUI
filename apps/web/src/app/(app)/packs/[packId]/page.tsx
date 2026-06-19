'use client';

/**
 * Pack Detail — /packs/[packId]
 * Sprint 15 (S15-002)
 *
 * Shows pack header (name, publisher, version, description),
 * the full skills list for this pack, and optional Data Pack dependencies.
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

interface Skill {
  type: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  color: string | null;
  uses_services: string[];
  data_pack_deps: string[];
}

const PACK_EMOJI: Record<string, string> = {
  'qsos.core-pack':        '⚙',
  'qsos.qs-pack':          '📐',
  'qsos.procurement-pack': '🛒',
  'qsos.document-pack':    '📄',
  'qsos.ai-pack':          '🤖',
};

const CATEGORY_ORDER = ['control', 'input', 'processing', 'output', 'ai', 'approval'];

function groupByCategory(skills: Skill[]): Map<string, Skill[]> {
  const map = new Map<string, Skill[]>();
  for (const s of skills) {
    const cat = s.category ?? 'other';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(s);
  }
  // Sort categories
  return new Map(
    [...map.entries()].sort(([a], [b]) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }),
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface PageProps {
  params: { packId: string };
}

export default function PackDetailPage({ params }: PageProps) {
  const packId = decodeURIComponent(params.packId);

  const [pack,   setPack]   = useState<Pack | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,  setError]  = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get<Pack[]>('/nodes/packs'),
      apiClient.get<Skill[]>(`/nodes?pack=${encodeURIComponent(packId)}`),
    ])
      .then(([packsRes, skillsRes]) => {
        const found = (packsRes.data ?? []).find((p) => p.id === packId) ?? null;
        setPack(found);
        setSkills(skillsRes.data ?? []);
      })
      .catch(() => setError('Failed to load pack details'))
      .finally(() => setLoading(false));
  }, [packId]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-400 text-center py-16">Loading…</div>;
  }
  if (error || !pack) {
    return (
      <div className="p-6 text-sm text-red-500 text-center py-16">
        {error ?? 'Pack not found'}
      </div>
    );
  }

  const grouped = groupByCategory(skills);

  // Aggregate data_pack_deps across all skills
  const allDataPackDeps = [...new Set(skills.flatMap((s) => s.data_pack_deps ?? []))];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <Link href="/packs" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
        ← Capability Packs
      </Link>

      {/* Pack header */}
      <div
        className="mt-4 rounded-xl border p-6"
        style={{ borderColor: pack.color ? `${pack.color}44` : '#E5E7EB', background: pack.color ? `${pack.color}08` : undefined }}
      >
        <div className="flex items-start gap-4">
          <div
            className="h-14 w-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{ backgroundColor: pack.color ? `${pack.color}22` : '#F3F4F6' }}
          >
            {PACK_EMOJI[pack.id] ?? pack.icon ?? '📦'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{pack.display_name}</h1>
              {pack.is_official && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                  Official
                </span>
              )}
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-green-50 text-green-600 border border-green-100">
                Installed
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">
              {pack.id} · v{pack.version} · by {pack.author}
            </p>
            {pack.description && (
              <p className="mt-2 text-sm text-gray-600">{pack.description}</p>
            )}
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
              <span><span className="font-semibold text-gray-700">{skills.length}</span> skills</span>
              {allDataPackDeps.length > 0 && (
                <span><span className="font-semibold text-gray-700">{allDataPackDeps.length}</span> data pack deps</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Skills by category */}
      <div className="mt-6 space-y-6">
        <h2 className="text-sm font-semibold text-gray-700">Skills in this pack</h2>

        {skills.length === 0 && (
          <p className="text-sm text-gray-400 italic">No skills registered for this pack yet.</p>
        )}

        {[...grouped.entries()].map(([category, catSkills]) => (
          <div key={category}>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2 capitalize">
              {category}
            </h3>
            <div className="space-y-2">
              {catSkills.map((skill) => (
                <div
                  key={skill.type}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-3 flex items-start gap-3"
                >
                  {/* Icon / dot */}
                  <div
                    className="h-7 w-7 rounded flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: (skill.color ?? pack.color) ? `${skill.color ?? pack.color}22` : '#F3F4F6' }}
                  >
                    {skill.icon ?? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: skill.color ?? pack.color ?? '#6B7280' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{skill.name}</p>
                    <p className="text-[10px] font-mono text-gray-400">{skill.type}</p>
                    {skill.description && (
                      <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{skill.description}</p>
                    )}
                    {/* Service chips */}
                    {skill.uses_services && skill.uses_services.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {skill.uses_services.map((svc) => (
                          <span key={svc} className="rounded px-1.5 py-0.5 text-[9px] font-medium bg-blue-50 text-blue-600 border border-blue-100">
                            {svc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Data Pack dependencies */}
      {allDataPackDeps.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Optional Data Pack dependencies</h2>
          <div className="flex flex-wrap gap-2">
            {allDataPackDeps.map((slug) => (
              <span key={slug} className="rounded-lg px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                📦 {slug}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
