import type { ContentArea } from '@/types/map';
import type { Bounds } from '@/types';

const STATUS_BAR_NAME_PATTERN =
  /\b(status\s*bar|statusbar|time|battery|wifi|wi-fi|cellular|signal|carrier|notch)\b/i;

const DEFAULT_STATUS_BAR_HEIGHT = 44;
const STATUS_BAR_SCAN_RATIO = 0.15;

/**
 * Detects status bar chrome height once and applies it globally across screens.
 */
export function detectGlobalContentArea(screens: Array<{ bounds: Bounds; node: SceneNode }>): ContentArea {
  let maxBottom = 0;

  for (const screen of screens) {
    const detected = detectStatusBarBottom(screen.node, screen.bounds);
    maxBottom = Math.max(maxBottom, detected);
  }

  const top =
    maxBottom > 0
      ? Math.min(maxBottom, Math.round(getReferenceFrameHeight(screens) * STATUS_BAR_SCAN_RATIO))
      : DEFAULT_STATUS_BAR_HEIGHT;

  const reference = screens[0]?.bounds;
  const width = reference?.width ?? 390;
  const height = reference?.height ?? 844;

  return {
    top,
    width,
    height: Math.max(height - top, 1),
  };
}

function getReferenceFrameHeight(screens: Array<{ bounds: Bounds }>): number {
  return screens[0]?.bounds.height ?? 844;
}

function detectStatusBarBottom(root: SceneNode, screenBounds: Bounds): number {
  let maxBottom = 0;
  const scanLimit = screenBounds.y + screenBounds.height * STATUS_BAR_SCAN_RATIO;

  const walk = (node: SceneNode): void => {
    if (!('absoluteBoundingBox' in node) || !node.absoluteBoundingBox) {
      if ('children' in node) {
        for (const child of node.children) {
          walk(child);
        }
      }
      return;
    }

    const box = node.absoluteBoundingBox;
    const isStatusBarLike =
      STATUS_BAR_NAME_PATTERN.test(node.name) ||
      (isLikelyStatusBarGroup(node) && box.y <= scanLimit);

    if (isStatusBarLike && box.y >= screenBounds.y - 1 && box.y <= scanLimit) {
      maxBottom = Math.max(maxBottom, box.y + box.height - screenBounds.y);
    }

    if ('children' in node) {
      for (const child of node.children) {
        walk(child);
      }
    }
  };

  walk(root);
  return maxBottom;
}

function isLikelyStatusBarGroup(node: SceneNode): boolean {
  if (node.type !== 'FRAME' && node.type !== 'GROUP' && node.type !== 'INSTANCE') {
    return false;
  }

  const name = node.name.toLowerCase();
  return name.includes('status') || name.includes('system') || name.includes('top bar');
}

export function isStatusBarNode(node: SceneNode, screenBounds: Bounds, contentAreaTop: number): boolean {
  if (!('absoluteBoundingBox' in node) || !node.absoluteBoundingBox) {
    return STATUS_BAR_NAME_PATTERN.test(node.name);
  }

  const box = node.absoluteBoundingBox;
  const relativeTop = box.y - screenBounds.y;

  if (relativeTop >= contentAreaTop) {
    return false;
  }

  return (
    STATUS_BAR_NAME_PATTERN.test(node.name) ||
    isLikelyStatusBarGroup(node) ||
    (relativeTop < contentAreaTop && box.height <= contentAreaTop + 4)
  );
}
