import { CONTEXT_FOLDER_NAME } from '@/constants';
import type { ExportTargetId } from '@/constants/export-targets';
import type { ContextPackage, ParsedDesign } from '@/types';
import { applyPlatformEnhancements, getPlatformAdapter } from '@/platforms';
import { translateDesign } from '@/translator';
import type { Exporter } from './base';
import { ContextPackageExporter } from './base';
import { JsonExporter } from './json-exporter';
import { ReadmeExporter } from './readme-exporter';

const defaultExporters: Exporter[] = [new ReadmeExporter(), new JsonExporter()];

/**
 * Creates the default set of context package exporters.
 * Register additional exporters here as the ecosystem grows.
 */
export function createDefaultExporters() {
  return [...defaultExporters];
}

export function exportContextPackage(
  design: ParsedDesign,
  exportTargetId: ExportTargetId = 'generic',
): ContextPackage {
  let semantic = translateDesign(design, exportTargetId);
  semantic = applyPlatformEnhancements(semantic, design, exportTargetId);

  const exporters: Exporter[] = [...createDefaultExporters()];
  const adapter = getPlatformAdapter(exportTargetId);
  if (adapter.getAdditionalExporters) {
    exporters.push(...adapter.getAdditionalExporters());
  }

  const exporter = new ContextPackageExporter({
    exporters,
    folderName: CONTEXT_FOLDER_NAME,
  });

  return exporter.export({ design, semantic });
}

export * from './navigation-notes-exporter';
export * from './base';
export * from './json-exporter';
export * from './readme-exporter';
