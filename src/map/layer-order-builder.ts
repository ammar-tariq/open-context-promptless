import type { ScreenLayerOrderManifest, ScreenMap } from '@/types/map';
import { walkMapViews } from '@/map/map-builder';

/**
 * Flat back-to-front paint order for a screen — decorative layers first, content on top.
 */
export function buildLayerOrder(map: ScreenMap): ScreenLayerOrderManifest {
  const layers: ScreenLayerOrderManifest['layers'] = [];

  walkMapViews(map.views, (node) => {
    if (!node.visible && node.role !== 'decorative') {
      return;
    }

    layers.push({
      id: node.id,
      figmaId: node.figmaId,
      name: node.name,
      viewKind: node.viewKind,
      role: node.role,
      zIndex: node.zIndex,
      topPercent: node.placement.absolute.topPercent ?? null,
      asset: node.asset,
      opacity: node.style?.opacity,
      visible: node.visible,
    });
  });

  layers.sort((a, b) => {
    if (a.zIndex !== b.zIndex) {
      return a.zIndex - b.zIndex;
    }
    return (a.topPercent ?? 0) - (b.topPercent ?? 0);
  });

  return {
    slug: map.screen.slug,
    readme:
      'Paint order back-to-front. Render decorative/gradient/blur layers before content. Do NOT skip low-opacity layers.',
    layers,
  };
}

export function countDecorativeLayersInOrder(manifest: ScreenLayerOrderManifest): number {
  return manifest.layers.filter((layer) => layer.role === 'decorative').length;
}
