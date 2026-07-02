import { create } from 'zustand';
import type { QSWorkflowDefinition } from '@lados/shared-types';

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

interface WorkflowState {
  workflowId: string | null;
  projectId: string | null;
  workflowName: string;
  definition: QSWorkflowDefinition | null;
  saveState: SaveState;
  loadError: string | null;

  setWorkflow: (
    workflowId: string,
    projectId: string,
    workflowName: string,
    definition: QSWorkflowDefinition,
  ) => void;
  setDefinition: (definition: QSWorkflowDefinition) => void;
  setWorkflowName: (workflowName: string) => void;
  setSaveState: (saveState: SaveState) => void;
  setLoadError: (loadError: string | null) => void;
  reset: () => void;
}

const initialWorkflowState = {
  workflowId: null,
  projectId: null,
  workflowName: '',
  definition: null,
  saveState: 'saved' as SaveState,
  loadError: null,
};

export const useWorkflowStore = create<WorkflowState>((set) => ({
  ...initialWorkflowState,

  setWorkflow: (workflowId, projectId, workflowName, definition) =>
    set({
      workflowId,
      projectId,
      workflowName,
      definition,
      saveState: 'saved',
      loadError: null,
    }),
  setDefinition: (definition) => set({ definition, saveState: 'unsaved' }),
  setWorkflowName: (workflowName) => set({ workflowName }),
  setSaveState: (saveState) => set({ saveState }),
  setLoadError: (loadError) => set({ loadError }),
  reset: () => set(initialWorkflowState),
}));
