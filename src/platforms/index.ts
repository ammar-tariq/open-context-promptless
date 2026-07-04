import type { ExportTargetId } from '@/constants/export-targets';
import { getExportTargetDefinition } from '@/constants/export-targets';
import type { ParsedDesign } from '@/types';
import type { SemanticDesign } from '@/types/semantic';
import { flutterPlatformAdapter, swiftUiPlatformAdapter } from './flutter';
import { genericPlatformAdapter } from './generic';
import { reactNativePlatformAdapter } from './react-native';
import type { PlatformAdapter } from './types';

const platformAdapters: PlatformAdapter[] = [
  genericPlatformAdapter,
  reactNativePlatformAdapter,
  flutterPlatformAdapter,
  swiftUiPlatformAdapter,
];

const adapterMap = new Map<ExportTargetId, PlatformAdapter>(
  platformAdapters.map((adapter) => [adapter.id, adapter]),
);

export function getPlatformAdapter(exportTargetId: ExportTargetId): PlatformAdapter {
  const adapter = adapterMap.get(exportTargetId);
  if (!adapter) {
    return genericPlatformAdapter;
  }
  return adapter;
}

export function applyPlatformEnhancements(
  semantic: SemanticDesign,
  design: ParsedDesign,
  exportTargetId: ExportTargetId,
): SemanticDesign {
  const adapter = getPlatformAdapter(exportTargetId);
  return adapter.enhanceSemantic(semantic, design);
}

export function validateExportTargetId(value: string): ExportTargetId {
  const definition = getExportTargetDefinition(value as ExportTargetId);
  if (definition.status !== 'supported') {
    throw new Error(`${definition.label} export is not available yet.`);
  }
  return definition.id;
}

export * from './types';
export { genericPlatformAdapter, reactNativePlatformAdapter, flutterPlatformAdapter };
