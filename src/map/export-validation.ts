import type { ExportWarning } from '@/types/map';
import type { SkippedAssetExport } from '@/services/asset-export-service';
import type { ScreenAssetsManifest } from '@/types/map';
import type { ContextPackageFile } from '@/types';

const TINY_ASSET_BYTES = 200;

export function buildExportWarnings(input: {
  skippedAssets: SkippedAssetExport[];
  screenAssets: ScreenAssetsManifest[];
  packageFiles: ContextPackageFile[];
}): ExportWarning[] {
  const warnings: ExportWarning[] = [];
  const filePaths = new Set(input.packageFiles.map((file) => file.path));

  for (const skipped of input.skippedAssets) {
    warnings.push({
      code: 'ASSET_EXPORT_SKIPPED',
      message: `Skipped ${skipped.kind} "${skipped.name}": ${skipped.reason}`,
      figmaId: skipped.nodeId,
    });
  }

  for (const screen of input.screenAssets) {
    for (const assetPath of screen.assets) {
      if (!filePaths.has(assetPath)) {
        warnings.push({
          code: 'ASSET_MISSING',
          message: `map/assets.json references ${assetPath} but file was not exported`,
          slug: screen.slug,
          assetPath,
        });
        continue;
      }

      const file = input.packageFiles.find((entry) => entry.path === assetPath);
      if (file?.encoding === 'base64' && typeof file.content === 'string') {
        const approxBytes = Math.floor((file.content.length * 3) / 4);
        if (approxBytes < TINY_ASSET_BYTES) {
          warnings.push({
            code: 'ASSET_SUSPICIOUSLY_SMALL',
            message: `${assetPath} is only ~${approxBytes} bytes — may be a broken export`,
            slug: screen.slug,
            assetPath,
          });
        }
      }
    }
  }

  return warnings;
}
