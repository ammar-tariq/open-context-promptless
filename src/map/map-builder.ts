import type { ParsedNode, ParsedScreen } from '@/types';
import type { SemanticNode } from '@/types/semantic';
import type { ContentArea, MapViewNode, ScreenMap } from '@/types/map';
import { buildViewPlacement } from '@/utils/placement';
import { isStatusBarNode } from '@/utils/status-bar';
import { toRouteName } from '@/utils/route-names';

interface BuildMapOptions {
  slug: string;
  contentArea: ContentArea;
  figmaNode?: SceneNode;
  zIndexStart?: number;
}

/**
 * Builds a screen-relative percentage layout map from parsed + semantic trees.
 */
export function buildScreenMap(
  screen: ParsedScreen,
  semanticScreen: SemanticNode,
  options: BuildMapOptions,
): ScreenMap {
  const { slug, contentArea } = options;
  const screenBounds = screen.bounds;
  let zCounter = options.zIndexStart ?? 1;

  const views = buildViewTree(
    screen.root.children,
    semanticScreen.children,
    screenBounds,
    contentArea,
    options.figmaNode,
    () => zCounter++,
  );

  return {
    screen: {
      id: slug,
      slug,
      name: screen.name,
      figmaId: screen.id,
      frame: {
        width: Math.round(screenBounds.width),
        height: Math.round(screenBounds.height),
      },
      contentArea,
      route: toRouteName(screen.name),
    },
    reference: 'reference.png',
    views,
  };
}

function buildViewTree(
  parsedNodes: ParsedNode[],
  semanticNodes: SemanticNode[],
  screenBounds: ParsedScreen['bounds'],
  contentArea: ContentArea,
  figmaRoot: SceneNode | undefined,
  nextZIndex: () => number,
): MapViewNode[] {
  const semanticById = new Map(semanticNodes.map((node) => [node.id, node]));
  const views: MapViewNode[] = [];

  for (const parsed of parsedNodes) {
    const semantic = semanticById.get(parsed.metadata.figmaId);
    const figmaNode = figmaRoot ? findFigmaChild(figmaRoot, parsed.metadata.figmaId) : undefined;
    const view = buildViewNode(parsed, semantic, screenBounds, contentArea, figmaNode, nextZIndex);
    if (view) {
      views.push(view);
    }
  }

  return views;
}

function buildViewNode(
  parsed: ParsedNode,
  semantic: SemanticNode | undefined,
  screenBounds: ParsedScreen['bounds'],
  contentArea: ContentArea,
  figmaNode: SceneNode | undefined,
  nextZIndex: () => number,
): MapViewNode | null {
  const visible = parsed.metadata.visible && parsed.metadata.opacity > 0;
  const isStatusBar = figmaNode ? isStatusBarNode(figmaNode, screenBounds, contentArea.top) : false;

  if (isStatusBar && visible) {
    return buildStatusBarView(parsed, semantic, screenBounds, contentArea, figmaNode, nextZIndex);
  }

  const isText = parsed.semanticType === 'Text';
  const includeSize = !isText;

  const { placement, placementPixels } = buildViewPlacement(
    parsed.bounds,
    screenBounds,
    contentArea,
    parsed.constraints,
    { includeSize },
  );

  const assetPath = extractAssetPath(semantic);
  const style = extractStyle(semantic, parsed);
  const text = isText ? extractText(parsed, semantic, screenBounds, contentArea) : undefined;

  const children = buildViewTree(
    parsed.children,
    semantic?.children ?? [],
    screenBounds,
    contentArea,
    figmaNode && 'children' in figmaNode ? figmaNode : undefined,
    nextZIndex,
  );

  if (!visible && children.length === 0 && !text && !assetPath) {
    return null;
  }

  return {
    id: parsed.metadata.figmaId,
    figmaId: parsed.metadata.figmaId,
    type: parsed.semanticType,
    name: parsed.metadata.name,
    zIndex: nextZIndex(),
    visible,
    role: 'content',
    sizing: isText ? 'intrinsic' : 'fixed',
    placement,
    placementPixels,
    ...(style ? { style } : {}),
    ...(text ? { text } : {}),
    ...(assetPath ? { asset: assetPath } : {}),
    ...(parsed.layout ? { source: { autoLayout: true } } : {}),
    children,
  };
}

function buildStatusBarView(
  parsed: ParsedNode,
  semantic: SemanticNode | undefined,
  screenBounds: ParsedScreen['bounds'],
  contentArea: ContentArea,
  figmaNode: SceneNode | undefined,
  nextZIndex: () => number,
): MapViewNode {
  const { placement, placementPixels } = buildViewPlacement(
    parsed.bounds,
    screenBounds,
    contentArea,
    parsed.constraints,
  );

  return {
    id: parsed.metadata.figmaId,
    figmaId: parsed.metadata.figmaId,
    type: parsed.semanticType,
    name: parsed.metadata.name,
    zIndex: nextZIndex(),
    visible: true,
    role: 'statusBar',
    sizing: 'fixed',
    placement,
    placementPixels,
    children: buildViewTree(
      parsed.children,
      semantic?.children ?? [],
      screenBounds,
      contentArea,
      figmaNode && 'children' in figmaNode ? figmaNode : undefined,
      nextZIndex,
    ),
  };
}

function extractAssetPath(semantic?: SemanticNode): string | undefined {
  if (!semantic?.assets || semantic.assets.length === 0) {
    return undefined;
  }

  for (const asset of semantic.assets) {
    const exportPath = asset.exportPath ?? asset.rasterExportPath;
    if (typeof exportPath === 'string' && exportPath.length > 0) {
      return exportPath;
    }
  }

  return undefined;
}

function extractStyle(
  semantic: SemanticNode | undefined,
  parsed: ParsedNode,
): MapViewNode['style'] | undefined {
  const fills = semantic?.colors as { fills?: Array<{ hex?: string }> } | undefined;
  const fill = fills?.fills?.[0]?.hex;
  const radius = parsed.cornerRadius?.uniform
    ? parsed.cornerRadius.topLeft
    : parsed.cornerRadius
      ? Math.max(
          parsed.cornerRadius.topLeft,
          parsed.cornerRadius.topRight,
          parsed.cornerRadius.bottomRight,
          parsed.cornerRadius.bottomLeft,
        )
      : undefined;

  const opacity = parsed.metadata.opacity < 1 ? parsed.metadata.opacity : undefined;

  if (!fill && radius === undefined && opacity === undefined) {
    return undefined;
  }

  return {
    ...(fill ? { backgroundColor: fill } : {}),
    ...(radius !== undefined ? { borderRadius: radius } : {}),
    ...(opacity !== undefined ? { opacity } : {}),
  };
}

function extractText(
  parsed: ParsedNode,
  semantic: SemanticNode | undefined,
  screenBounds: ParsedScreen['bounds'],
  contentArea: ContentArea,
): MapViewNode['text'] | undefined {
  const content = parsed.textContent ?? (typeof semantic?.text === 'string' ? semantic.text : semantic?.text?.content);
  if (!content) {
    return undefined;
  }

  const typography = parsed.typography;
  const segmentColor = typography?.segments?.[0]?.color?.hex;
  const fillColor = (semantic?.colors as { fills?: Array<{ hex?: string }> } | undefined)?.fills?.[0]?.hex;

  const text: NonNullable<MapViewNode['text']> = {
    content,
    fontSize: typography?.fontSize ?? 16,
    ...(typography?.fontFamily ? { fontFamily: typography.fontFamily } : {}),
    ...(typography?.fontWeight ? { fontWeight: typography.fontWeight } : {}),
    ...(typography?.fontStyle ? { fontStyle: typography.fontStyle } : {}),
    color: segmentColor ?? fillColor,
    ...(typography?.textAlignHorizontal
      ? { textAlign: typography.textAlignHorizontal.toLowerCase() }
      : {}),
  };

  if (parsed.bounds.width > 0 && parsed.bounds.width < screenBounds.width * 0.98) {
    text.maxWidthPercent = Math.round((parsed.bounds.width / contentArea.width) * 10000) / 100;
  }

  return text;
}

function findFigmaChild(root: SceneNode, figmaId: string): SceneNode | undefined {
  if (root.id === figmaId) {
    return root;
  }

  if (!('children' in root)) {
    return undefined;
  }

  for (const child of root.children) {
    const found = findFigmaChild(child, figmaId);
    if (found) {
      return found;
    }
  }

  return undefined;
}

export function countParsedNodes(node: ParsedNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countParsedNodes(child);
  }
  return count;
}
