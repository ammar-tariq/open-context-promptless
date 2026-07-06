import { create } from 'zustand';
import type { ExportTargetId } from '@/constants/export-targets';
import { DEFAULT_EXPORT_TARGET } from '@/constants/export-targets';
import type { ExportSummary } from '@/types';
import type { GenerateErrorPayload, ScreenSummary } from '@/types/messages';

export type UiStatus = 'idle' | 'loading' | 'success' | 'error';

interface PluginState {
  projectName: string;
  exportTarget: ExportTargetId;
  pageName: string;
  screens: ScreenSummary[];
  checkedScreenIds: string[];
  status: UiStatus;
  progress: number;
  progressStage: string;
  summary: ExportSummary | null;
  error: GenerateErrorPayload | null;
  setProjectName: (name: string) => void;
  setExportTarget: (exportTarget: ExportTargetId) => void;
  setScreensState: (payload: {
    pageName: string;
    screens: ScreenSummary[];
    defaultProjectName: string;
    defaultCheckedScreenIds: string[];
  }) => void;
  toggleScreen: (screenId: string) => void;
  selectAllScreens: () => void;
  clearScreenSelection: () => void;
  setLoading: () => void;
  setProgress: (stage: string, progress: number) => void;
  setSuccess: (summary: ExportSummary) => void;
  setError: (error: GenerateErrorPayload) => void;
  resetStatus: () => void;
}

function countCheckedExportableScreens(
  screens: ScreenSummary[],
  checkedScreenIds: string[],
): number {
  const checked = new Set(checkedScreenIds);
  return screens.filter((screen) => checked.has(screen.id) && !screen.empty).length;
}

export const usePluginStore = create<PluginState>((set) => ({
  projectName: '',
  exportTarget: DEFAULT_EXPORT_TARGET,
  pageName: '',
  screens: [],
  checkedScreenIds: [],
  status: 'idle',
  progress: 0,
  progressStage: '',
  summary: null,
  error: null,
  setProjectName: (projectName) => set({ projectName }),
  setExportTarget: (exportTarget) => set({ exportTarget }),
  setScreensState: ({
    pageName,
    screens,
    defaultProjectName,
    defaultCheckedScreenIds,
  }) =>
    set((state) => {
      const preservedChecked = state.checkedScreenIds.filter((id) =>
        screens.some((screen) => screen.id === id && !screen.empty),
      );
      const checkedScreenIds =
        preservedChecked.length > 0 ? preservedChecked : defaultCheckedScreenIds;

      return {
        pageName,
        screens,
        checkedScreenIds,
        projectName: state.projectName || defaultProjectName,
      };
    }),
  toggleScreen: (screenId) =>
    set((state) => {
      const screen = state.screens.find((entry) => entry.id === screenId);
      if (!screen || screen.empty) {
        return state;
      }

      const checked = new Set(state.checkedScreenIds);
      if (checked.has(screenId)) {
        checked.delete(screenId);
      } else {
        checked.add(screenId);
      }

      return { checkedScreenIds: Array.from(checked) };
    }),
  selectAllScreens: () =>
    set((state) => ({
      checkedScreenIds: state.screens.filter((screen) => !screen.empty).map((screen) => screen.id),
    })),
  clearScreenSelection: () => set({ checkedScreenIds: [] }),
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

export function useSelectedScreenCount(): number {
  const screens = usePluginStore((state) => state.screens);
  const checkedScreenIds = usePluginStore((state) => state.checkedScreenIds);
  return countCheckedExportableScreens(screens, checkedScreenIds);
}
