import type { ExportTargetId } from '@/constants/export-targets';
import type { ExportSummary } from './index';
import type { VariantExportMode } from './map';

export type PluginMessageType =
  | 'INIT'
  | 'INIT_RESPONSE'
  | 'GENERATE_CONTEXT'
  | 'GENERATE_PROGRESS'
  | 'EXPORT_FILE'
  | 'GENERATE_SUCCESS'
  | 'GENERATE_ERROR'
  | 'RESIZE_UI';

export interface ScreenSummary {
  id: string;
  name: string;
  type: string;
  empty: boolean;
  nodeCount: number;
  normalizedName: string;
}

export interface DuplicateScreenGroup {
  name: string;
  normalizedName: string;
  screens: Array<{
    id: string;
    name: string;
    nodeCount: number;
  }>;
}

export interface InitResponsePayload {
  pageName: string;
  screens: ScreenSummary[];
  defaultProjectName: string;
  defaultCheckedScreenIds: string[];
  duplicateGroups: DuplicateScreenGroup[];
}

export interface GenerateContextPayload {
  projectName: string;
  exportTarget: ExportTargetId;
  selectedScreenIds: string[];
  variantMode: VariantExportMode;
  canonicalOverrides?: Record<string, string>;
}

export interface GenerateProgressPayload {
  stage: string;
  progress: number;
}

export interface ExportFilePayload {
  folderName: string;
  path: string;
  content: string;
  encoding?: 'utf8' | 'base64';
}

export interface GenerateSuccessPayload {
  summary: ExportSummary;
  folderName: string;
  fileCount: number;
  exportDirectory: string;
  starterPrompt: string;
}

export interface GenerateErrorPayload {
  code: string;
  message: string;
  details: string;
}

export interface ResizeUiPayload {
  width: number;
  height: number;
}

export type PluginMessagePayload =
  | InitResponsePayload
  | GenerateContextPayload
  | GenerateProgressPayload
  | ExportFilePayload
  | GenerateSuccessPayload
  | GenerateErrorPayload
  | ResizeUiPayload
  | Record<string, never>;

export interface PluginMessage<T extends PluginMessageType = PluginMessageType> {
  type: T;
  payload?: PluginMessagePayload;
}

export function createMessage<T extends PluginMessageType>(
  type: T,
  payload?: Extract<PluginMessage, { type: T }> extends { payload?: infer P } ? P : never,
): PluginMessage<T> {
  return { type, payload } as PluginMessage<T>;
}
