import { create } from 'zustand';
import type { Edge, Node, Viewport } from 'reactflow';
import type { QSWorkflowDefinition } from '@lados/shared-types';
import type { SkillMode } from '@lados/shared-types';

export interface BulkModeRequest {
  nodeTypes: string[];
  mode: SkillMode;
  stamp: number;
}

export interface DraftRequest {
  definition: QSWorkflowDefinition;
  stamp: number;
}

interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  viewport: Viewport;
  readOnly: boolean;
  hasValidationErrors: boolean;
  bulkModeRequest: BulkModeRequest | null;
  draftRequest: DraftRequest | null;

  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNodeId: (selectedNodeId: string | null) => void;
  setViewport: (viewport: Viewport) => void;
  setReadOnly: (readOnly: boolean) => void;
  setHasValidationErrors: (hasValidationErrors: boolean) => void;
  setBulkModeRequest: (bulkModeRequest: BulkModeRequest | null) => void;
  setDraftRequest: (draftRequest: DraftRequest | null) => void;
  resetCanvas: () => void;
}

const initialCanvasState = {
  nodes: [] as Node[],
  edges: [] as Edge[],
  selectedNodeId: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  readOnly: false,
  hasValidationErrors: false,
  bulkModeRequest: null as BulkModeRequest | null,
  draftRequest: null as DraftRequest | null,
};

export const useCanvasStore = create<CanvasState>((set) => ({
  ...initialCanvasState,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  setViewport: (viewport) => set({ viewport }),
  setReadOnly: (readOnly) => set({ readOnly }),
  setHasValidationErrors: (hasValidationErrors) => set({ hasValidationErrors }),
  setBulkModeRequest: (bulkModeRequest) => set({ bulkModeRequest }),
  setDraftRequest: (draftRequest) => set({ draftRequest }),
  resetCanvas: () => set(initialCanvasState),
}));
