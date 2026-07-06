import type { ExportTargetId } from '@/constants/export-targets';
import type { ContextPackage, ExportSummary, ExportOptions, ParsedDesign } from '@/types';
import { defaultVariantMode } from '@/services/variant-resolution-service';
import { validateProjectName } from '@/shared/schemas';
import { exportContextPackage } from '@/exporters';
import { parseDesign } from '@/parser';
import { validateExportTargetId, applyPlatformEnhancements } from '@/platforms';
import { translateDesign } from '@/translator';
import { ExportLikeError, extractErrorDetails } from '@/utils/error-details';
import { generateStarterPrompt } from '@/utils/starter-prompt';
import { exportDesignAssets, enrichDesignWithAssetPaths } from './asset-export-service';
import { getExportNodesByIds, SelectionError } from './selection-service';
import { buildExportWarnings } from '@/map/export-validation';
import { buildScreenPackage } from './screen-package-service';
import { resolveScreenVariants } from './variant-resolution-service';

export class ExportError extends ExportLikeError {
  constructor(message: string, code: string, details?: string) {
    super(message, code, details ?? message);
    this.name = 'ExportError';
  }
}

export interface ExportResult {
  folderName: string;
  files: ContextPackage['files'];
  design: ParsedDesign;
  summary: ExportSummary;
  starterPrompt: string;
}

export interface ExportProgressHandler {
  (stage: string, progress: number): void;
}

export interface GenerateContextOptions {
  exportOptions?: ExportOptions;
}

function filterDesignScreens(design: ParsedDesign, screenIds: Set<string>): ParsedDesign {
  const screens = design.screens.filter((screen) => screenIds.has(screen.id));
  return {
    ...design,
    screens,
    metadata: {
      ...design.metadata,
      screenCount: screens.length,
    },
  };
}

/**
 * Runs the full export pipeline: parse → export assets → translate → export package.
 */
export async function generateContextPackage(
  projectName: string,
  exportTargetId: ExportTargetId,
  selectedScreenIds: string[],
  onProgress?: ExportProgressHandler,
  options?: GenerateContextOptions,
): Promise<ExportResult> {
  try {
    const normalizedName = validateProjectName(projectName);
    const normalizedTarget = validateExportTargetId(exportTargetId);
    const exportOptions = options?.exportOptions ?? { variantMode: defaultVariantMode() };

    onProgress?.('Reading screens', 0.05);

    const nodes = await getExportNodesByIds(selectedScreenIds);
    onProgress?.('Parsing design', 0.15);

    const design = await parseDesign(
      {
        projectName: normalizedName,
        nodes,
      },
      onProgress,
    );

    const resolution = resolveScreenVariants(design.screens, exportOptions);
    const selectedIds = new Set(resolution.selectedScreens.map((screen) => screen.id));
    const exportDesign = filterDesignScreens(design, selectedIds);

    onProgress?.('Exporting assets', 0.85);
    const rasterOnly = normalizedTarget === 'react-native';
    const assetResult = await exportDesignAssets(exportDesign, onProgress, { rasterOnly });

    const enrichedDesign = enrichDesignWithAssetPaths(
      exportDesign,
      assetResult.nodeExportPaths,
      assetResult.nodeRasterExportPaths,
      { rasterOnly },
    );

    let semantic = translateDesign(enrichedDesign, normalizedTarget);
    semantic = applyPlatformEnhancements(semantic, enrichedDesign, normalizedTarget);

    onProgress?.('Building context package', 0.9);
    const contextPackage = exportContextPackage(enrichedDesign, normalizedTarget);
    contextPackage.files.push(...assetResult.files);

    const selectedNodes = nodes.filter((node) => selectedIds.has(node.id));
    const screenPackageResult = await buildScreenPackage({
      design: enrichedDesign,
      semantic,
      nodes: selectedNodes,
      options: exportOptions,
      exportTarget: normalizedTarget,
      skippedAssets: assetResult.skippedAssets,
      onProgress,
    });

    contextPackage.files.push(...screenPackageResult.files);

    const warnings = buildExportWarnings({
      skippedAssets: assetResult.skippedAssets,
      screenAssets: screenPackageResult.screenAssetsManifests,
      packageFiles: contextPackage.files,
    });

    if (warnings.length > 0) {
      contextPackage.files.push({
        path: 'export-warnings.json',
        content: JSON.stringify({ warnings }, null, 2),
      });
    }

    if (contextPackage.files.length === 0) {
      throw new ExportError('Export produced no files.', 'EXPORT_EMPTY');
    }

    onProgress?.('Preparing files for export', 0.99);

    const mapFileCount = screenPackageResult.files.filter((file) => file.path.endsWith('/map.json')).length;
    const referenceImageCount = screenPackageResult.files.filter((file) =>
      file.path.endsWith('/reference.png'),
    ).length;

    const starterPrompt = generateStarterPrompt({
      projectName: normalizedName,
      exportTarget: normalizedTarget,
      screenCount: screenPackageResult.exportedScreenCount,
      uniqueScreenNames: screenPackageResult.uniqueScreenNameCount,
      variantMode: exportOptions.variantMode,
      skippedVariantCount: screenPackageResult.skippedVariantCount,
    });

    return {
      folderName: contextPackage.folderName,
      files: contextPackage.files,
      design: enrichedDesign,
      starterPrompt,
      summary: {
        screenCount: screenPackageResult.exportedScreenCount,
        componentCount: enrichedDesign.metadata.componentCount,
        imageCount: enrichedDesign.metadata.imageCount,
        iconCount: enrichedDesign.icons.length,
        exportedAssetCount: assetResult.exportedAssetCount,
        deduplicatedAssetCount: assetResult.deduplicatedAssetCount,
        skippedAssetCount: assetResult.skippedAssets.length,
        navigationLinkCount: enrichedDesign.navigation.linkCount,
        textElementCount: enrichedDesign.metadata.textElementCount,
        mapFileCount,
        referenceImageCount,
        skippedVariantCount: screenPackageResult.skippedVariantCount,
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
