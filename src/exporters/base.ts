import type { ContextPackage, ContextPackageFile, ParsedDesign } from '@/types';
import type { SemanticDesign } from '@/types/semantic';

export interface ExportContext {
  design: ParsedDesign;
  semantic: SemanticDesign;
}

export interface Exporter {
  readonly id: string;
  readonly fileName: string;
  export(context: ExportContext): ContextPackageFile;
}

export interface PackageExporterOptions {
  exporters: Exporter[];
  folderName?: string;
}

/**
 * Orchestrates multiple exporters into a single context package.
 * Add new exporters to extend output without modifying existing modules.
 */
export class ContextPackageExporter {
  private readonly exporters: Exporter[];
  private readonly folderName: string;

  constructor(options: PackageExporterOptions) {
    this.exporters = options.exporters;
    this.folderName = options.folderName ?? 'context';
  }

  export(context: ExportContext): ContextPackage {
    const files = this.exporters.map((exporter) => exporter.export(context));

    return {
      folderName: this.folderName,
      files,
    };
  }
}

export abstract class BaseExporter implements Exporter {
  abstract readonly id: string;
  abstract readonly fileName: string;
  abstract export(context: ExportContext): ContextPackageFile;

  protected buildFile(content: string): ContextPackageFile {
    return {
      path: `${this.fileName}`,
      content,
    };
  }
}
