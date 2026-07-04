import { CONTEXT_FOLDER_NAME } from '@/constants';
import type { ContextPackage, ParsedDesign } from '@/types';
import { translateDesign } from '@/translator';
import { ContextPackageExporter } from './base';
import { JsonExporter } from './json-exporter';
import { ReadmeExporter } from './readme-exporter';

const defaultExporters = [new ReadmeExporter(), new JsonExporter()];

/**
 * Creates the default set of context package exporters.
 * Register additional exporters here as the ecosystem grows.
 */
export function createDefaultExporters() {
  return [...defaultExporters];
}

export function exportContextPackage(design: ParsedDesign): ContextPackage {
  const semantic = translateDesign(design);
  const exporter = new ContextPackageExporter({
    exporters: createDefaultExporters(),
    folderName: CONTEXT_FOLDER_NAME,
  });

  return exporter.export({ design, semantic });
}

export * from './base';
export * from './json-exporter';
export * from './readme-exporter';
