'use client';

import { useEffect, useMemo, useState } from 'react';
import NodePalette from '@/components/canvas/NodePalette';
import DataPackBrowser from '@/components/canvas/DataPackBrowser';
import LibraryPanel from '@/components/canvas/LibraryPanel';
import RunHistoryPanel from '@/components/canvas/RunHistoryPanel';
import ExplorerResourcesTab from './ExplorerResourcesTab';
import ExplorerTemplatesTab from './ExplorerTemplatesTab';
import ExplorerPacksTab from './ExplorerPacksTab';
import ExplorerVersionsTab from './ExplorerVersionsTab';
import { useUIStore } from '@/stores';
import type { ExplorerTab, NodeLog, RunSummary } from '@/stores';
import type { QSWorkflowDefinition, SkillMode } from '@lados/shared-types';

interface ExplorerShellProps {
  workflowId: string;
  projectId: string;
  organizationId: string;
  readOnly?: boolean;
  groupRunRefreshKey?: number;
  reRunning: boolean;
  onBulkMode: (nodeTypes: string[], mode: SkillMode) => void;
  onLoadRun: (summary: RunSummary, logs: NodeLog[]) => void;
  onReRun: () => void;
  onApplyTemplate: (definition: QSWorkflowDefinition) => void;
  onVersionRestored: () => void;
}

interface ExplorerTabConfig {
  id: ExplorerTab;
  label: string;
  compact: string;
  title: string;
}

const TAB_CONFIG: ExplorerTabConfig[] = [
  { id: 'nodes', label: 'Nodes', compact: 'N', title: 'Skill nodes' },
  { id: 'resources', label: 'Resources', compact: 'R', title: 'Project resources' },
  { id: 'templates', label: 'Templates', compact: 'T', title: 'Workflow templates' },
  { id: 'runs', label: 'Runs', compact: 'U', title: 'Workflow and group runs' },
  { id: 'packs', label: 'Packs', compact: 'P', title: 'Capability packs' },
  { id: 'versions', label: 'Versions', compact: 'V', title: 'Workflow versions' },
  { id: 'documents', label: 'Files', compact: 'F', title: 'Document library' },
  { id: 'datapacks', label: 'Data', compact: 'D', title: 'Data packs' },
];

const LEGACY_TAB_MAP: Partial<Record<ExplorerTab, ExplorerTab>> = {
  history: 'runs',
};

function normaliseTab(tab: ExplorerTab): ExplorerTab {
  return LEGACY_TAB_MAP[tab] ?? tab;
}

function isExplorerTab(value: string | null): value is ExplorerTab {
  return !!value && TAB_CONFIG.some((tab) => tab.id === value);
}

export default function ExplorerShell({
  workflowId,
  projectId,
  organizationId,
  readOnly = false,
  groupRunRefreshKey = 0,
  reRunning,
  onBulkMode,
  onLoadRun,
  onReRun,
  onApplyTemplate,
  onVersionRestored,
}: ExplorerShellProps) {
  const explorerTab = useUIStore((state) => state.explorerTab);
  const setExplorerTab = useUIStore((state) => state.setExplorerTab);
  const explorerCollapsed = useUIStore((state) => state.explorerCollapsed);
  const setExplorerCollapsed = useUIStore((state) => state.setExplorerCollapsed);
  const [search, setSearch] = useState('');

  const activeTab = useMemo(() => {
    const normalised = normaliseTab(explorerTab);
    return TAB_CONFIG.some((tab) => tab.id === normalised) ? normalised : 'nodes';
  }, [explorerTab]);

  useEffect(() => {
    const storedTab = window.localStorage.getItem('lados.explorer.activeTab');
    const storedCollapsed = window.localStorage.getItem('lados.explorer.collapsed');
    if (isExplorerTab(storedTab)) setExplorerTab(storedTab);
    if (storedCollapsed === 'true' || storedCollapsed === 'false') {
      setExplorerCollapsed(storedCollapsed === 'true');
    }
  }, [setExplorerCollapsed, setExplorerTab]);

  useEffect(() => {
    window.localStorage.setItem('lados.explorer.activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    window.localStorage.setItem('lados.explorer.collapsed', String(explorerCollapsed));
  }, [explorerCollapsed]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        setExplorerCollapsed(!useUIStore.getState().explorerCollapsed);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setExplorerCollapsed]);

  useEffect(() => {
    if (explorerTab !== activeTab) setExplorerTab(activeTab);
  }, [activeTab, explorerTab, setExplorerTab]);

  if (explorerCollapsed) {
    return (
      <aside className="flex w-12 flex-shrink-0 flex-col border-r border-gray-200 bg-white">
        <button
          type="button"
          onClick={() => setExplorerCollapsed(false)}
          title="Expand Explorer"
          className="border-b border-gray-100 py-3 text-xs font-bold text-gray-500 hover:bg-gray-50 hover:text-blue-600"
        >
          EX
        </button>
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-1.5">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.id}
              type="button"
              title={tab.title}
              onClick={() => {
                setExplorerTab(tab.id);
                setExplorerCollapsed(false);
              }}
              className={`h-8 rounded text-[10px] font-bold transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
              }`}
            >
              {tab.compact}
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-72 flex-shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-gray-100 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Explorer</p>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search active tab..."
            className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setExplorerCollapsed(true)}
          title="Collapse Explorer"
          className="h-8 w-8 flex-shrink-0 rounded border border-gray-200 text-xs font-bold text-gray-400 hover:bg-gray-50 hover:text-gray-700"
        >
          ‹
        </button>
      </div>

      <div className="grid flex-shrink-0 grid-cols-4 gap-1 border-b border-gray-100 p-2">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            type="button"
            title={tab.title}
            onClick={() => setExplorerTab(tab.id)}
            className={`min-h-8 rounded px-1 py-1 text-[10px] font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'nodes' && <NodePalette onBulkMode={onBulkMode} searchOverride={search} />}
        {activeTab === 'resources' && (
          <ExplorerResourcesTab
            organizationId={organizationId}
            projectId={projectId}
            search={search}
          />
        )}
        {activeTab === 'templates' && (
          <ExplorerTemplatesTab
            projectId={projectId}
            workflowId={workflowId}
            organizationId={organizationId}
            search={search}
            readOnly={readOnly}
            onApplyTemplate={onApplyTemplate}
          />
        )}
        {activeTab === 'runs' && (
          <RunHistoryPanel
            workflowId={workflowId}
            projectId={projectId}
            groupRunRefreshKey={groupRunRefreshKey}
            reRunning={reRunning}
            onLoadRun={onLoadRun}
            onReRun={onReRun}
          />
        )}
        {activeTab === 'packs' && <ExplorerPacksTab search={search} />}
        {activeTab === 'versions' && (
          <ExplorerVersionsTab
            projectId={projectId}
            workflowId={workflowId}
            search={search}
            onRestored={onVersionRestored}
          />
        )}
        {activeTab === 'documents' && (
          <LibraryPanel organizationId={organizationId} projectId={projectId} />
        )}
        {activeTab === 'datapacks' && (
          <DataPackBrowser organizationId={organizationId} search={search} />
        )}
      </div>
    </aside>
  );
}
