import type { ExportTargetId } from '@/constants/export-targets';
import type { ExportSummary } from './index';

export type PluginMessageType =
  | 'INIT'
  | 'INIT_RESPONSE'
  | 'GENERATE_CONTEXT'
  | 'GENERATE_PROGRESS'
  | 'GENERATE_SUCCESS'
  | 'GENERATE_ERROR'
  | 'RESIZE_UI';

export interface ScreenSummary {
  id: string;
  name: string;
  type: string;
  empty: boolean;
}

export interface InitResponsePayload {
  pageName: string;
  screens: ScreenSummary[];
  defaultProjectName: string;
  defaultCheckedScreenIds: string[];
}

export interface GenerateContextPayload {
  projectName: string;
  exportTarget: ExportTargetId;
  selectedScreenIds: string[];
}

export interface GenerateProgressPayload {
  stage: string;
  progress: number;
}

export interface GenerateSuccessPayload {
  zipBase64: string;
  zipFileName: string;
  summary: ExportSummary;
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
