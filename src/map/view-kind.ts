import type { ParsedNode } from '@/types';
import type { MapViewNode, ViewKind } from '@/types/map';

const DECORATIVE_NAME = /ellipse|blob|glow|spot|decoration|gradient-bg/i;
const DRAWER_TRIGGER_NAME = /hamburger|menu-icon|drawer|sidebar/i;

export interface ViewKindContext {
  screenSlug: string;
  allSlugs: string[];
  hasBottomTabBarLabels: boolean;
}

export function inferViewKind(parsed: ParsedNode, context: ViewKindContext): ViewKind {
  const name = parsed.metadata.name.toLowerCase();
  const figmaType = parsed.metadata.figmaType;
  const opacity = parsed.metadata.opacity;
  const hasBlur = parsed.effects?.some(
    (effect) =>
      effect.visible !== false &&
      (effect.type === 'LAYER_BLUR' || effect.type === 'BACKGROUND_BLUR'),
  );
  const hasGradient = (parsed.gradients?.length ?? 0) > 0;
  const hasText = nodeHasTextDescendant(parsed);
  const hasAsset = Boolean(parsed.assets?.some((a) => a.rasterExportPath || a.exportPath));

  if (
    context.hasBottomTabBarLabels &&
    parsed.bounds.height <= 120 &&
    parsed.children.some((child) => /home|explore|search|profile|map|events/i.test(child.metadata.name))
  ) {
    return 'bottomTabBar';
  }

  if (parsed.semanticType === 'Text') {
    return 'text';
  }

  if (parsed.semanticType === 'Input') {
    return 'textField';
  }

  if (parsed.semanticType === 'Button' || name.includes('button') || name.includes('btn')) {
    return 'primaryButton';
  }

  if (parsed.semanticType === 'Navigation' || name.includes('tab bar')) {
    return 'bottomTabBar';
  }

  if (DRAWER_TRIGGER_NAME.test(name)) {
    return 'drawerTrigger';
  }

  if (hasBlur) {
    return 'blurView';
  }

  if (hasGradient && isDecorativeCandidate(parsed, hasText)) {
    return 'linearGradient';
  }

  if (isDecorativeCandidate(parsed, hasText)) {
    return 'decorative';
  }

  if (parsed.semanticType === 'Image' || name.includes('image') || name.includes('photo')) {
    return 'image';
  }

  if (
    parsed.semanticType === 'Icon' ||
    name.includes('icon') ||
    figmaType === 'VECTOR' ||
    (hasAsset && parsed.bounds.width <= 128 && parsed.bounds.height <= 128)
  ) {
    return 'icon';
  }

  if (parsed.semanticType === 'Screen') {
    return 'screen';
  }

  if (
    parsed.semanticType === 'Container' ||
    parsed.semanticType === 'Frame' ||
    parsed.semanticType === 'Group' ||
    parsed.semanticType === 'Section'
  ) {
    return 'container';
  }

  if (figmaType === 'ELLIPSE' && opacity < 0.85) {
    return 'decorative';
  }

  return 'container';
}

export function isDecorativeCandidate(parsed: ParsedNode, hasTextDescendant = false): boolean {
  if (hasTextDescendant) {
    return false;
  }

  const name = parsed.metadata.name;
  const figmaType = parsed.metadata.figmaType;
  const opacity = parsed.metadata.opacity;

  if (parsed.semanticType === 'Button' || parsed.semanticType === 'Input') {
    return false;
  }

  if (DECORATIVE_NAME.test(name)) {
    return true;
  }

  if (figmaType === 'ELLIPSE' && opacity < 0.85) {
    return true;
  }

  if (
    opacity < 0.35 &&
    !name.toLowerCase().includes('button') &&
    parsed.bounds.width > 40 &&
    parsed.bounds.height > 40
  ) {
    return true;
  }

  return false;
}

export function inferMapNodeRole(viewKind: ViewKind, isStatusBar: boolean): MapViewNode['role'] {
  if (isStatusBar) {
    return 'statusBar';
  }

  if (
    viewKind === 'decorative' ||
    viewKind === 'linearGradient' ||
    viewKind === 'blurView'
  ) {
    return 'decorative';
  }

  if (viewKind === 'bottomTabBar' || viewKind === 'navigation' || viewKind === 'drawerTrigger') {
    return 'navigation';
  }

  return 'content';
}

export function buildImplementationHint(viewKind: ViewKind): MapViewNode['implementation'] {
  const dictionaryRef = `platform/react-native/views.json#${viewKind}`;

  if (viewKind === 'decorative' || viewKind === 'linearGradient' || viewKind === 'blurView') {
    return {
      dictionaryRef,
      pointerEvents: 'none',
      notes: 'Background layer — not a layout container. Use exported PNG or dictionary library.',
    };
  }

  if (viewKind === 'bottomTabBar') {
    return {
      dictionaryRef,
      notes: 'App-level @react-navigation/bottom-tabs — do not paste into every screen.',
    };
  }

  if (viewKind === 'drawerTrigger') {
    return {
      dictionaryRef,
      notes: 'Opens @react-navigation/drawer — wire navigation.openDrawer().',
    };
  }

  return { dictionaryRef };
}

export function detectDrawerMenuSlug(allSlugs: string[]): string | null {
  const match = allSlugs.find((slug) => /menu|drawer|sidebar/i.test(slug));
  return match ?? null;
}

export function nodeHasTextDescendant(parsed: ParsedNode): boolean {
  if (parsed.semanticType === 'Text' || parsed.textContent) {
    return true;
  }

  return parsed.children.some(nodeHasTextDescendant);
}

const TAB_LABEL_PATTERN = /home|explore|search|profile|map|events|activity|settings/i;

export function screenHasBottomTabBarLabels(parsedNodes: ParsedNode[]): boolean {
  for (const node of parsedNodes) {
    if (/tab bar|bottom tab|bottom nav/i.test(node.metadata.name)) {
      return true;
    }

    if (
      node.bounds.height <= 120 &&
      node.children.filter((child) => TAB_LABEL_PATTERN.test(child.metadata.name)).length >= 2
    ) {
      return true;
    }

    if (screenHasBottomTabBarLabels(node.children)) {
      return true;
    }
  }

  return false;
}
