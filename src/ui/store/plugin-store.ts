import { create } from 'zustand';
import type { ExportTargetId } from '@/constants/export-targets';
import { DEFAULT_EXPORT_TARGET } from '@/constants/export-targets';
import type { ExportSummary } from '@/types';
import type { VariantExportMode } from '@/types/map';
import type { DuplicateScreenGroup, GenerateErrorPayload, CheckExportReadinessResponsePayload, ScreenSummary } from '@/types/messages';

export type UiStatus = 'idle' | 'loading' | 'success' | 'error';

interface PluginState {
  projectName: string;
  exportTarget: ExportTargetId;
  pageName: string;
  screens: ScreenSummary[];
  checkedScreenIds: string[];
  duplicateGroups: DuplicateScreenGroup[];
  variantMode: VariantExportMode;
  canonicalOverrides: Record<string, string>;
  status: UiStatus;
  progress: number;
  progressStage: string;
  summary: ExportSummary | null;
  starterPrompt: string | null;
  error: GenerateErrorPayload | null;
  preExportLint: CheckExportReadinessResponsePayload | null;
  preExportLintLoading: boolean;
  setProjectName: (name: string) => void;
  setExportTarget: (exportTarget: ExportTargetId) => void;
  setScreensState: (payload: {
    pageName: string;
    screens: ScreenSummary[];
    defaultProjectName: string;
    defaultCheckedScreenIds: string[];
    duplicateGroups: DuplicateScreenGroup[];
  }) => void;
  setVariantMode: (mode: VariantExportMode) => void;
  setCanonicalOverride: (normalizedName: string, screenId: string) => void;
  toggleScreen: (screenId: string) => void;
  selectAllScreens: () => void;
  clearScreenSelection: () => void;
  setLoading: () => void;
  setProgress: (stage: string, progress: number) => void;
  setSuccess: (summary: ExportSummary, starterPrompt: string) => void;
  setError: (error: GenerateErrorPayload) => void;
  setPreExportLint: (result: CheckExportReadinessResponsePayload | null) => void;
  setPreExportLintLoading: (loading: boolean) => void;
  resetStatus: () => void;
}

function countCheckedExportableScreens(
  screens: ScreenSummary[],
  checkedScreenIds: string[],
): number {
  const checked = new Set(checkedScreenIds);
  return screens.filter((screen) => checked.has(screen.id) && !screen.empty).length;
}

function buildDefaultCanonicalOverrides(groups: DuplicateScreenGroup[]): Record<string, string> {
  const overrides: Record<string, string> = {};

  for (const group of groups) {
    const canonical = [...group.screens].sort((a, b) => b.nodeCount - a.nodeCount)[0];
    if (canonical) {
      overrides[group.normalizedName] = canonical.id;
    }
  }

  return overrides;
}

export const usePluginStore = create<PluginState>((set) => ({
  projectName: '',
  exportTarget: DEFAULT_EXPORT_TARGET,
  pageName: '',
  screens: [],
  checkedScreenIds: [],
  duplicateGroups: [],
  variantMode: 'canonical',
  canonicalOverrides: {},
  status: 'idle',
  progress: 0,
  progressStage: '',
  summary: null,
  starterPrompt: null,
  error: null,
  preExportLint: null,
  preExportLintLoading: false,
  setProjectName: (projectName) => set({ projectName }),
  setExportTarget: (exportTarget) => set({ exportTarget }),
  setScreensState: ({
    pageName,
    screens,
    defaultProjectName,
    defaultCheckedScreenIds,
    duplicateGroups,
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
        duplicateGroups,
        canonicalOverrides: buildDefaultCanonicalOverrides(duplicateGroups),
        projectName: state.projectName || defaultProjectName,
      };
    }),
  setVariantMode: (variantMode) => set({ variantMode }),
  setCanonicalOverride: (normalizedName, screenId) =>
    set((state) => ({
      canonicalOverrides: {
        ...state.canonicalOverrides,
        [normalizedName]: screenId,
      },
    })),
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
      starterPrompt: null,
    }),
  setProgress: (progressStage, progress) => set({ progressStage, progress }),
  setSuccess: (summary, starterPrompt) =>
    set({
      status: 'success',
      progress: 1,
      progressStage: 'Complete',
      summary,
      starterPrompt,
      error: null,
    }),
  setError: (error) =>
    set({
      status: 'error',
      error,
    }),
  setPreExportLint: (preExportLint) => set({ preExportLint, preExportLintLoading: false }),
  setPreExportLintLoading: (preExportLintLoading) => set({ preExportLintLoading }),
  resetStatus: () =>
    set({
      status: 'idle',
      progress: 0,
      progressStage: '',
      summary: null,
      starterPrompt: null,
      error: null,
    }),
}));

export function useSelectedScreenCount(): number {
  const screens = usePluginStore((state) => state.screens);
  const checkedScreenIds = usePluginStore((state) => state.checkedScreenIds);
  return countCheckedExportableScreens(screens, checkedScreenIds);
}
