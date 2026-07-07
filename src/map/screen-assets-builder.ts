import type {
  MapViewNode,
  ScreenAssetsManifest,
  ScreenDecorativeManifest,
  ScreenMap,
} from '@/types/map';
import { walkMapViews } from '@/map/map-builder';

function categorizeAssetPath(path: string): 'decorative' | 'icon' | 'photo' | 'other' {
  if (path.includes('/decorative/')) {
    return 'decorative';
  }

  if (/ellipse|blob|glow|decoration|decorative|bg-icon|-decorative/i.test(path)) {
    return 'decorative';
  }

  if (/image-\d+|event-|home-|calendar-open|map-view|mask\.png/i.test(path)) {
    return 'photo';
  }

  if (/icon|path-|shape-|vector-|combined-shape|bell-|profile-|location-/i.test(path)) {
    return 'icon';
  }

  return 'other';
}

export function buildScreenAssetsManifest(map: ScreenMap): ScreenAssetsManifest {
  const assets = new Set<string>();
  const decorative = new Set<string>();
  const icons = new Set<string>();
  const photos = new Set<string>();

  walkMapViews(map.views, (node) => {
    if (!node.asset) {
      return;
    }

    assets.add(node.asset);
    const category = categorizeAssetPath(node.asset);

    if (category === 'decorative' || node.role === 'decorative') {
      decorative.add(node.asset);
    } else if (category === 'icon') {
      icons.add(node.asset);
    } else if (category === 'photo') {
      photos.add(node.asset);
    }
  });

  return {
    slug: map.screen.slug,
    assets: Array.from(assets).sort(),
    decorative: Array.from(decorative).sort(),
    icons: Array.from(icons).sort(),
    photos: Array.from(photos).sort(),
  };
}

export function buildScreenDecorativeManifest(map: ScreenMap): ScreenDecorativeManifest {
  const layers: ScreenDecorativeManifest['layers'] = [];

  walkMapViews(map.views, (node) => {
    if (
      node.role !== 'decorative' &&
      node.viewKind !== 'decorative' &&
      node.viewKind !== 'linearGradient' &&
      node.viewKind !== 'blurView'
    ) {
      return;
    }

    layers.push({
      figmaId: node.figmaId,
      name: node.name,
      viewKind: node.viewKind as ScreenDecorativeManifest['layers'][0]['viewKind'],
      asset: node.asset,
      opacity: node.style?.opacity,
      placement: node.placement,
      placementPixels: node.placementPixels,
      gradient: node.style?.gradient,
      blur: node.style?.blur,
      renderHint:
        node.asset && node.viewKind === 'blurView'
          ? 'Prefer exported PNG at style.opacity (blur baked in from Figma) — fallback: expo-blur BlurView'
          : node.viewKind === 'blurView'
            ? 'Use expo-blur BlurView at map opacity — not a semi-transparent View'
            : node.viewKind === 'linearGradient'
              ? 'Use expo-linear-gradient from style.gradient — or exported PNG asset if present'
              : 'Absolute Image from asset at style.opacity — pointerEvents none — NOT solid backgroundColor',
    });
  });

  return {
    slug: map.screen.slug,
    layers,
  };
}

export function collectAssetsFromNode(node: MapViewNode, bucket: Set<string>): void {
  if (node.asset) {
    bucket.add(node.asset);
  }

  for (const child of node.children) {
    collectAssetsFromNode(child, bucket);
  }
}
