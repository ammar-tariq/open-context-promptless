import type { AssetManifest, AssetManifestEntry, ScreenAssetsManifest } from '@/types/map';
import type { ParsedDesign } from '@/types';

function inferCategory(path: string): AssetManifestEntry['category'] {
  if (/ellipse|blob|decoration|decorative|bg-icon/i.test(path)) {
    return 'decorative';
  }

  if (/image-\d+|event-|\.png$/i.test(path) && !/icon|path-|shape-/i.test(path)) {
    return 'photo';
  }

  if (/icon|path-|shape-|vector-|combined-shape|bell-|profile-|location-/i.test(path)) {
    return 'icon';
  }

  return 'other';
}

export function buildAssetManifest(
  screenAssets: ScreenAssetsManifest[],
  design: ParsedDesign,
  exportTarget: string,
): AssetManifest {
  const byPath = new Map<string, AssetManifestEntry>();

  for (const screen of screenAssets) {
    for (const path of screen.assets) {
      const existing = byPath.get(path);
      if (existing) {
        if (!existing.usedBySlugs.includes(screen.slug)) {
          existing.usedBySlugs.push(screen.slug);
        }
        continue;
      }

      const designAsset = [...design.images, ...design.icons].find(
        (asset) => asset.rasterExportPath === path || asset.exportPath === path,
      );

      byPath.set(path, {
        path,
        type: 'png',
        width: designAsset?.width,
        height: designAsset?.height,
        usedBySlugs: [screen.slug],
        category: inferCategory(path),
      });
    }
  }

  const assets = Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path));

  return {
    format: 'png-only',
    exportTarget,
    totalCount: assets.length,
    assets,
  };
}

export function buildRegistryScaffold(manifest: AssetManifest): string {
  const lines = manifest.assets.map((entry) => {
    return `  '${entry.path}': require('../../context/${entry.path}'),`;
  });

  return `// Auto-generated scaffold — copy into src/design-assets/registry.ts
// Only includes assets referenced by screen assets.json files (${manifest.totalCount} files)

export const designAssetRegistry: Record<string, number> = {
${lines.join('\n')}
};

export function getDesignAsset(path: string): number | undefined {
  return designAssetRegistry[path];
}
`;
}
