import type { Bounds, ConstraintInfo } from '@/types';
import type {
  ContentArea,
  PlacementPreferred,
  PlacementPixels,
  ViewPlacement,
} from '@/types/map';

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function toPercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return roundPercent((value / total) * 100);
}

function pickPreferred(constraints?: ConstraintInfo): PlacementPreferred {
  if (!constraints) {
    return 'absolute';
  }

  if (constraints.horizontal === 'CENTER' || constraints.vertical === 'CENTER') {
    return 'center';
  }

  if (
    constraints.horizontal === 'MAX' ||
    constraints.vertical === 'MAX' ||
    constraints.horizontal === 'STRETCH' ||
    constraints.vertical === 'STRETCH'
  ) {
    return 'insets';
  }

  return 'absolute';
}

/**
 * Builds hybrid placement encodings relative to the screen content area.
 */
export function buildViewPlacement(
  bounds: Bounds,
  screenBounds: Bounds,
  contentArea: ContentArea,
  constraints?: ConstraintInfo,
  options?: { includeSize?: boolean },
): { placement: ViewPlacement; placementPixels: PlacementPixels } {
  const includeSize = options?.includeSize ?? true;

  const left = bounds.x - screenBounds.x;
  const top = bounds.y - screenBounds.y - contentArea.top;
  const width = bounds.width;
  const height = bounds.height;

  const contentWidth = contentArea.width;
  const contentHeight = contentArea.height;

  const leftPercent = toPercent(left, contentWidth);
  const topPercent = toPercent(top, contentHeight);
  const widthPercent = includeSize ? toPercent(width, contentWidth) : undefined;
  const heightPercent = includeSize ? toPercent(height, contentHeight) : undefined;

  const right = contentWidth - (left + width);
  const bottom = contentHeight - (top + height);

  const centerXPercent =
    includeSize && width > 0
      ? roundPercent(leftPercent + (widthPercent ?? 0) / 2)
      : roundPercent(leftPercent);
  const centerYPercent =
    includeSize && height > 0
      ? roundPercent(topPercent + (heightPercent ?? 0) / 2)
      : roundPercent(topPercent);

  const preferred = pickPreferred(constraints);

  const placement: ViewPlacement = {
    absolute: {
      leftPercent,
      topPercent,
      ...(widthPercent !== undefined ? { widthPercent } : {}),
      ...(heightPercent !== undefined ? { heightPercent } : {}),
    },
    insets: {
      topPercent,
      leftPercent,
      rightPercent: includeSize ? toPercent(right, contentWidth) : null,
      bottomPercent: includeSize ? toPercent(bottom, contentHeight) : null,
    },
    center: {
      centerXPercent,
      centerYPercent: includeSize ? centerYPercent : null,
      ...(widthPercent !== undefined ? { widthPercent } : {}),
      ...(heightPercent !== undefined ? { heightPercent } : {}),
    },
    ...(constraints ? { constraints } : {}),
    preferred,
  };

  const placementPixels: PlacementPixels = {
    left: Math.round(left),
    top: Math.round(top),
    ...(includeSize
      ? {
          width: Math.round(width),
          height: Math.round(height),
        }
      : {}),
  };

  return { placement, placementPixels };
}
