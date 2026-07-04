import type { ExportSummary, ParsedDesign } from '@/types';
import { validateProjectName } from '@/shared/schemas';
import { exportContextPackage } from '@/exporters';
import { parseDesign } from '@/parser';
import { ExportLikeError, extractErrorDetails } from '@/utils/error-details';
import { exportDesignAssets, enrichDesignWithAssetPaths } from './asset-export-service';
import { createContextZipBase64, getContextZipFileName } from './zip-service';
import { getSelectedExportNodes, SelectionError } from './selection-service';

export class ExportError extends ExportLikeError {
  constructor(message: string, code: string, details?: string) {
    super(message, code, details ?? message);
    this.name = 'ExportError';
  }
}

export interface ExportResult {
  zipBase64: string;
  zipFileName: string;
  design: ParsedDesign;
  summary: ExportSummary;
}

export interface ExportProgressHandler {
  (stage: string, progress: number): void;
}

/**
 * Runs the full export pipeline: parse → export assets → translate → export package.
 */
export async function generateContextPackage(
  projectName: string,
  onProgress?: ExportProgressHandler,
): Promise<ExportResult> {
  try {
    const normalizedName = validateProjectName(projectName);
    onProgress?.('Reading selection', 0.05);

    const nodes = getSelectedExportNodes();
    onProgress?.('Parsing design', 0.15);

    const design = await parseDesign(
      {
        projectName: normalizedName,
        nodes,
      },
      onProgress,
    );

    onProgress?.('Exporting assets', 0.85);
    const assetResult = await exportDesignAssets(design, onProgress);

    const enrichedDesign = enrichDesignWithAssetPaths(
      design,
      assetResult.nodeExportPaths,
      assetResult.nodeRasterExportPaths,
    );

    onProgress?.('Building context package', 0.96);
    const contextPackage = exportContextPackage(enrichedDesign);
    contextPackage.files.push(...assetResult.files);

    if (contextPackage.files.length === 0) {
      throw new ExportError('Export produced no files.', 'EXPORT_EMPTY');
    }

    onProgress?.('Creating download archive', 0.98);
    const zipBase64 = await createContextZipBase64(contextPackage);

    onProgress?.('Complete', 1);

    return {
      zipBase64,
      zipFileName: getContextZipFileName(contextPackage.folderName),
      design: enrichedDesign,
      summary: {
        screenCount: enrichedDesign.metadata.screenCount,
        componentCount: enrichedDesign.metadata.componentCount,
        imageCount: enrichedDesign.metadata.imageCount,
        iconCount: enrichedDesign.icons.length,
        exportedAssetCount: assetResult.exportedAssetCount,
        skippedAssetCount: assetResult.skippedAssets.length,
        textElementCount: enrichedDesign.metadata.textElementCount,
      },
    };
  } catch (error) {
    if (error instanceof SelectionError) {
      throw new ExportError(error.message, error.code, formatSelectionErrorDetails(error));
    }

    if (error instanceof ExportError) {
      throw error;
    }

    const extracted = extractErrorDetails(error, 'EXPORT_FAILED');
    throw new ExportError(extracted.message, extracted.code, extracted.details);
  }
}

function formatSelectionErrorDetails(error: SelectionError): string {
  return [`Code: ${error.code}`, `Message: ${error.message}`].join('\n');
}

export { SelectionError };
