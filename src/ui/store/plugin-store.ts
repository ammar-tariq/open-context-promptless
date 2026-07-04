import { create } from 'zustand';
import type { ExportSummary } from '@/types';
import type { GenerateErrorPayload, SelectedNodeSummary } from '@/types/messages';

export type UiStatus = 'idle' | 'loading' | 'success' | 'error';

interface PluginState {
  projectName: string;
  selectionCount: number;
  exportableCount: number;
  selectionNames: string[];
  selectedItems: SelectedNodeSummary[];
  status: UiStatus;
  progress: number;
  progressStage: string;
  summary: ExportSummary | null;
  error: GenerateErrorPayload | null;
  setProjectName: (name: string) => void;
  setInitState: (payload: {
    selectionCount: number;
    exportableCount: number;
    selectionNames: string[];
    selectedItems: SelectedNodeSummary[];
    defaultProjectName: string;
  }) => void;
  setLoading: () => void;
  setProgress: (stage: string, progress: number) => void;
  setSuccess: (summary: ExportSummary) => void;
  setError: (error: GenerateErrorPayload) => void;
  resetStatus: () => void;
}

export const usePluginStore = create<PluginState>((set) => ({
  projectName: '',
  selectionCount: 0,
  exportableCount: 0,
  selectionNames: [],
  selectedItems: [],
  status: 'idle',
  progress: 0,
  progressStage: '',
  summary: null,
  error: null,
  setProjectName: (projectName) => set({ projectName }),
  setInitState: ({
    selectionCount,
    exportableCount,
    selectionNames,
    selectedItems,
    defaultProjectName,
  }) =>
    set((state) => ({
      selectionCount,
      exportableCount,
      selectionNames,
      selectedItems,
      projectName: state.projectName || defaultProjectName,
    })),
  setLoading: () =>
    set({
      status: 'loading',
      progress: 0,
      progressStage: 'Starting export…',
      error: null,
      summary: null,
    }),
  setProgress: (progressStage, progress) => set({ progressStage, progress }),
  setSuccess: (summary) =>
    set({
      status: 'success',
      progress: 1,
      progressStage: 'Complete',
      summary,
      error: null,
    }),
  setError: (error) =>
    set({
      status: 'error',
      error,
    }),
  resetStatus: () =>
    set({
      status: 'idle',
      progress: 0,
      progressStage: '',
      summary: null,
      error: null,
    }),
}));
