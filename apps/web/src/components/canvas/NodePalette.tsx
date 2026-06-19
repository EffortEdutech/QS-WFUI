'use client';

/**
 * NodePalette — "Skill Library" in V3 terminology.
 *
 * Shows all available skills grouped by Capability Pack.
 * Drag a skill card onto the canvas to add it as a node.
 *
 * Sprint 5:  initial — flat list driven by live GET /api/v1/nodes
 * Sprint 13: V3 — renamed "Skill Library", grouped by pack, service chips,
 *                  search filters across name + description + tags.
 */

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api/client';
import type { SkillMode } from '@qsos/shared-types';

// ── Type definitions ──────────────────────────────────────────────────────────

interface RegisteredNode {
  type: string;
  name: string;
  description?: string;
  category: string;
  icon?: string;
  color?: string;
  tags?: string[];
  pack_id: string;
  uses_services?: string[];
  data_pack_deps?: string[];
  packs?: {
    id: string;
    display_name: string;
    color?: string;
    icon?: string;
  };
}

// ── Service chip helpers ──────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, string> = {
  'ai-service':       '🤖',
  'storage-service':  '💾',
  'audit-service':    '📋',
  'auth-service':     '🔐',
  'ocr-service':      '🔍',
  'document-service': '📄',
  'notification-service': '🔔',
};

const SERVICE_LABELS: Record<string, string> = {
  'ai-service':       'AI',
  'storage-service':  'Storage',
  'audit-service':    'Audit',
  'auth-service':     'Auth',
  'ocr-service':      'OCR',
  'document-service': 'Docs',
  'notification-service': 'Notify',
};

function ServiceChip({ service }: { service: string }) {
  const icon  = SERVICE_ICONS[service]  ?? '⚙';
  const label = SERVICE_LABELS[service] ?? service;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium bg-gray-100 text-gray-500"
      title={service}
    >
      {icon} {label}
    </span>
  );
}

// ── Pack section ──────────────────────────────────────────────────────────────

interface PackSectionProps {
  packName: string;
  packColor?: string;
  nodes: RegisteredNode[];
  onDragStart: (e: React.DragEvent, node: RegisteredNode) => void;
  onBulkMode?: (nodeTypes: string[], mode: SkillMode) => void;
  defaultOpen?: boolean;
}

const BULK_ACTIONS: { mode: SkillMode; icon: string; title: string }[] = [
  { mode: 'active',   icon: '▶',  title: 'Activate All' },
  { mode: 'muted',    icon: '🔇', title: 'Mute All'     },
  { mode: 'bypassed', icon: '⏭',  title: 'Bypass All'   },
];

function PackSection({ packName, packColor, nodes, onDragStart, onBulkMode, defaultOpen = true }: PackSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [hoverHeader, setHoverHeader] = useState(false);

  const nodeTypes = nodes.map((n) => n.type);

  return (
    <div className="mb-3">
      {/* Pack header */}
      <div
        className="flex w-full items-center justify-between gap-1 mb-1"
        onMouseEnter={() => setHoverHeader(true)}
        onMouseLeave={() => setHoverHeader(false)}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-1.5 min-w-0 group"
        >
          <span
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{ backgroundColor: packColor ?? '#6B7280' }}
          />
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider truncate">
            {packName}
          </span>
          <span className="text-[9px] text-gray-400 flex-shrink-0">
            ({nodes.length})
          </span>
          <span className="text-[10px] text-gray-300 group-hover:text-gray-400 flex-shrink-0 ml-auto">
            {open ? '▾' : '▸'}
          </span>
        </button>

        {/* Bulk mode controls — visible on hover when onBulkMode is provided */}
        {onBulkMode && (
          <div
            className={`flex items-center gap-0.5 flex-shrink-0 transition-opacity ${
              hoverHeader ? 'opacity-100' : 'opacity-0'
            }`}
          >
       