import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ExplorerTab =
  | 'nodes'
  | 'documents'
  | 'datapacks'
  | 'history'
  | 'resources'
  | 'templates'
  | 'runs'
  | 'packs'
  | 'versions';

interface UIState {
  explorerTab: ExplorerTab;
  explorerCollapsed: boolean;
  showExecutionLog: boolean;
  showDesignStudio: boolean;
  showVersionHistory: boolean;
  showUploadPanel: boolean;
  organizationId: string | null;

  setExplorerTab: (explorerTab: ExplorerTab) => void;
  setExplorerCollapsed: (explorerCollapsed: boolean) => void;
  toggleExecutionLog: () => void;
  setShowExecutionLog: (showExecutionLog: boolean) => void;
  setShowDesignStudio: (showDesignStudio: boolean) => void;
  setShowVersionHistory: (showVersionHistory: boolean) => void;
  setShowUploadPanel: (showUploadPanel: boolean) => void;
  setOrganizationId: (organizationId: string | null) => void;
  resetUI: () => void;
}

const initialUIState = {
  explorerTab: 'nodes' as ExplorerTab,
  explorerCollapsed: false,
  showExecutionLog: false,
  showDesignStudio: false,
  showVersionHistory: false,
  showUploadPanel: false,
  organizationId: null,
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      ...initialUIState,

      setExplorerTab: (explorerTab) => set({ explorerTab }),
      setExplorerCollapsed: (explorerCollapsed) => set({ explorerCollapsed }),
      toggleExecutionLog: () =>
        set((state) => ({ showExecutionLog: !state.showExecutionLog })),
      setShowExecutionLog: (showExecutionLog) => set({ showExecutionLog }),
      setShowDesignStudio: (showDesignStudio) => set({ showDesignStudio }),
      setShowVersionHistory: (showVersionHistory) => set({ showVersionHistory }),
      setShowUploadPanel: (showUploadPanel) => set({ showUploadPanel }),
      setOrganizationId: (organizationId) => set({ organizationId }),
      resetUI: () => set(initialUIState),
    }),
    {
      name: 'lados.ui',
      partialize: (state) => ({
        explorerTab: state.explorerTab,
        explorerCollapsed: state.explorerCollapsed,
      }),
    },
  ),
);
