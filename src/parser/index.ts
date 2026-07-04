import type {
  AssetReference,
  AutoLayoutInfo,
  BorderInfo,
  Bounds,
  ColorToken,
  ColorValue,
  ComponentSummary,
  ComponentVariantProperty,
  ConstraintInfo,
  CornerRadiusInfo,
  DesignMetadata,
  EffectInfo,
  ParsedDesign,
  ParsedNode,
  ParsedNodeMetadata,
  ParsedScreen,
  SpacingValue,
  TextStyleSegment,
  TypographyStyle,
  VariableBinding,
} from '@/types';
import { PLUGIN_VERSION } from '@/constants';
import { formatExportDate, getBoundVariables, hasVisibleContent, rgbToColorValue } from '@/utils';

export interface ParseOptions {
  projectName: string;
  nodes: readonly SceneNode[];
}

export interface ParseProgressCallback {
  (stage: string, progress: number): void;
}

/**
 * Parses selected Figma nodes into a normalized design model.
 */
export async function parseDesign(
  options: ParseOptions,
  onProgress?: ParseProgressCallback,
): Promise<ParsedDesign> {
  const { projectName, nodes } = options;

  onProgress?.('Validating selection', 0.1);

  const screens: ParsedScreen[] = [];
  const colorMap = new Map<string, ColorToken>();
  const typographyMap = new Map<string, TypographyStyle>();
  const imageMap = new Map<string, AssetReference>();
  const iconMap = new Map<string, AssetReference>();
  const componentMap = new Map<string, ComponentSummary>();

  const total = nodes.length;

  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if (!node) continue;

    onProgress?.(`Parsing screen ${index + 1} of ${total}`, 0.2 + (index / total) * 0.6);

    const root = await parseNodeTree(node, {
      colorMap,
      typographyMap,
      imageMap,
      iconMap,
      componentMap,
      isRoot: true,
    });

    screens.push({
      id: node.id,
      name: node.name,
      bounds: getBounds(node),
      root,
    });
  }

  onProgress?.('Collecting metadata', 0.9);

  const metadata = buildMetadata(screens, componentMap, imageMap);

  return {
    projectName,
    exportedAt: formatExportDate(new Date()),
    pluginVersion: PLUGIN_VERSION,
    screens,
    components: Array.from(componentMap.values()),
    colors: Array.from(colorMap.values()),
    typography: Array.from(typographyMap.values()),
    images: Array.from(imageMap.values()),
    icons: Array.from(iconMap.values()),
    metadata,
  };
}

interface ParseContext {
  colorMap: Map<string, ColorToken>;
  typographyMap: Map<string, TypographyStyle>;
  imageMap: Map<string, AssetReference>;
  iconMap: Map<string, AssetReference>;
  componentMap: Map<string, ComponentSummary>;
  isRoot?: boolean;
}

async function parseNodeTree(node: SceneNode, context: ParseContext): Promise<ParsedNode> {
  collectTokensFromNode(node, context);

  const typography = node.type === 'TEXT' ? await extractTypography(node) : undefined;
  if (typography) {
    registerTypographyToken(typography, context.typographyMap);
  }

  const children: ParsedNode[] = [];

  if ('children' in node) {
    for (const child of node.children) {
      if (!child.visible) continue;
      children.push(await parseNodeTree(child, { ...context, isRoot: false }));
    }
  }

  return {
    metadata: buildMetadataForNode(node),
    semanticType: inferSemanticType(node, context.isRoot ?? false),
    bounds: getBounds(node),
    layout: extractAutoLayout(node),
    constraints: extractConstraints(node),
    typography,
    fills: extractFills(node),
    strokes: extractStrokes(node),
    effects: extractEffects(node),
    cornerRadius: extractCornerRadius(node),
    spacing: extractPadding(node),
    textContent: node.type === 'TEXT' ? node.characters : undefined,
    componentId: getComponentId(node),
    componentName: getComponentName(node),
    isInstance: node.type === 'INSTANCE',
    variantProperties: extractVariantProperties(node),
    variables: await extractVariables(node),
    assets: extractAssets(node, context),
    children,
  };
}

function buildMetadataForNode(node: SceneNode): ParsedNodeMetadata {
  return {
    figmaId: node.id,
    figmaType: node.type,
    name: node.name,
    visible: node.visible,
    locked: node.locked,
    opacity: 'opacity' in node ? node.opacity : 1,
    blendMode: 'blendMode' in node ? String(node.blendMode) : 'NORMAL',
  };
}

function getBounds(node: SceneNode): Bounds {
  if ('absoluteBoundingBox' in node && node.absoluteBoundingBox) {
    const box = node.absoluteBoundingBox;
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    };
  }

  return { x: 0, y: 0, width: 0, height: 0 };
}

function extractAutoLayout(node: SceneNode): AutoLayoutInfo | undefined {
  if (!('layoutMode' in node) || node.layoutMode === 'NONE') {
    return undefined;
  }

  return {
    mode: node.layoutMode,
    primaryAxisAlignItems: node.primaryAxisAlignItems,
    counterAxisAlignItems: node.counterAxisAlignItems,
    primaryAxisSizingMode: node.primaryAxisSizingMode,
    counterAxisSizingMode: node.counterAxisSizingMode,
    itemSpacing: node.itemSpacing,
    padding: {
      top: node.paddingTop,
      right: node.paddingRight,
      bottom: node.paddingBottom,
      left: node.paddingLeft,
    },
    layoutWrap: 'layoutWrap' in node ? String(node.layoutWrap) : 'NO_WRAP',
  };
}

function extractConstraints(node: SceneNode): ConstraintInfo | undefined {
  if (!('constraints' in node)) {
    return undefined;
  }

  return {
    horizontal: node.constraints.horizontal,
    vertical: node.constraints.vertical,
  };
}

async function extractTypography(node: TextNode): Promise<TypographyStyle | undefined> {
  await loadTextNodeFonts(node);

  try {
    const segments = node.getStyledTextSegments([
      'fontName',
      'fontSize',
      'lineHeight',
      'letterSpacing',
      'fills',
      'textDecoration',
      'textCase',
    ]);

    if (segments.length === 0) {
      return undefined;
    }

    const parsedSegments: TextStyleSegment[] = segments.map((segment) => {
      const fontName = segment.fontName;
      const fillColor = extractSegmentFillColor(segment.fills);

      return {
        start: segment.start,
        end: segment.end,
        characters: segment.characters,
        fontFamily: fontName.family,
        fontStyle: fontName.style,
        fontWeight: parseFontWeight(fontName.style),
        fontSize: segment.fontSize,
        lineHeight:
          segment.lineHeight.unit === 'AUTO'
            ? 'AUTO'
            : 'value' in segment.lineHeight
              ? segment.lineHeight.value
              : 'AUTO',
        letterSpacing:
          segment.letterSpacing.unit === 'PERCENT'
            ? segment.letterSpacing.value
            : segment.letterSpacing.value,
        textDecoration: String(segment.textDecoration),
        textCase: String(segment.textCase),
        color: fillColor,
      };
    });

    const primary = parsedSegments[0];
    if (!primary) {
      return undefined;
    }

    const mixedStyles =
      parsedSegments.length > 1 &&
      new Set(parsedSegments.map((segment) => `${segment.fontFamily}|${segment.fontStyle}`)).size > 1;

    return {
      fontFamily: mixedStyles ? 'Mixed' : primary.fontFamily,
      fontStyle: mixedStyles ? 'Mixed' : primary.fontStyle,
      fontWeight: primary.fontWeight,
      fontSize: primary.fontSize,
      lineHeight: primary.lineHeight,
      letterSpacing: primary.letterSpacing,
      textAlignHorizontal: String(node.textAlignHorizontal),
      textAlignVertical: String(node.textAlignVertical),
      textDecoration: primary.textDecoration,
      textCase: primary.textCase,
      mixed: mixedStyles,
      segments: parsedSegments,
    };
  } catch {
    return extractTypographyFallback(node);
  }
}

async function loadTextNodeFonts(node: TextNode): Promise<void> {
  if (node.characters.length === 0) {
    return;
  }

  try {
    const fonts = node.getRangeAllFontNames(0, node.characters.length);
    await Promise.all(
      fonts.map((font) =>
        figma.loadFontAsync(font).catch(() => {
          // Continue export even if a font cannot be loaded.
        }),
      ),
    );
  } catch {
    // Best-effort font loading.
  }
}

function extractSegmentFillColor(fills: readonly Paint[] | typeof figma.mixed): ColorValue | undefined {
  if (fills === figma.mixed || !Array.isArray(fills)) {
    return undefined;
  }

  for (const paint of fills) {
    if (paint.type === 'SOLID' && paint.visible !== false) {
      return rgbToColorValue(paint.color, paint.opacity ?? 1);
    }
  }

  return undefined;
}

function extractTypographyFallback(node: TextNode): TypographyStyle | undefined {
  const fontName = node.fontName;
  if (fontName === figma.mixed) {
    return {
      fontFamily: 'Mixed',
      fontStyle: 'Mixed',
      fontWeight: 400,
      fontSize: 0,
      lineHeight: 'AUTO',
      letterSpacing: 0,
      textAlignHorizontal: String(node.textAlignHorizontal),
      textAlignVertical: String(node.textAlignVertical),
      textDecoration: String(node.textDecoration),
      textCase: String(node.textCase),
      mixed: true,
      segments: [],
    };
  }

  return {
    fontFamily: fontName.family,
    fontStyle: fontName.style,
    fontWeight: parseFontWeight(fontName.style),
    fontSize: node.fontSize === figma.mixed ? 0 : node.fontSize,
    lineHeight:
      node.lineHeight === figma.mixed
        ? 'AUTO'
        : node.lineHeight.unit === 'AUTO'
          ? 'AUTO'
          : node.lineHeight.value,
    letterSpacing: node.letterSpacing === figma.mixed ? 0 : node.letterSpacing.value,
    textAlignHorizontal: String(node.textAlignHorizontal),
    textAlignVertical: String(node.textAlignVertical),
    textDecoration: String(node.textDecoration),
    textCase: String(node.textCase),
    mixed: false,
  };
}

function registerTypographyToken(
  typography: TypographyStyle,
  typographyMap: Map<string, TypographyStyle>,
): void {
  if (typography.segments && typography.segments.length > 0) {
    for (const segment of typography.segments) {
      const key = `${segment.fontFamily}-${segment.fontStyle}-${segment.fontWeight}-${segment.fontSize}`;
      if (!typographyMap.has(key)) {
        typographyMap.set(key, {
          fontFamily: segment.fontFamily,
          fontStyle: segment.fontStyle,
          fontWeight: segment.fontWeight,
          fontSize: segment.fontSize,
          lineHeight: segment.lineHeight,
          letterSpacing: segment.letterSpacing,
          textAlignHorizontal: typography.textAlignHorizontal,
          textAlignVertical: typography.textAlignVertical,
          textDecoration: segment.textDecoration,
          textCase: segment.textCase,
          mixed: false,
        });
      }
    }
    return;
  }

  const key = `${typography.fontFamily}-${typography.fontStyle}-${typography.fontWeight}-${typography.fontSize}`;
  if (!typographyMap.has(key)) {
    typographyMap.set(key, typography);
  }
}

function parseFontWeight(style: string): number {
  const match = style.match(/\d+/);
  if (match) {
    return Number(match[0]);
  }

  const normalized = style.toLowerCase();
  if (normalized.includes('bold')) return 700;
  if (normalized.includes('medium')) return 500;
  if (normalized.includes('light')) return 300;
  if (normalized.includes('thin')) return 100;
  return 400;
}

function extractFills(node: SceneNode): ColorValue[] | undefined {
  if (!('fills' in node) || node.fills === figma.mixed || !Array.isArray(node.fills)) {
    return undefined;
  }

  const fills: ColorValue[] = [];

  for (const paint of node.fills) {
    if (paint.type === 'SOLID' && paint.visible !== false) {
      fills.push(rgbToColorValue(paint.color, paint.opacity ?? 1));
    }
  }

  return fills.length > 0 ? fills : undefined;
}

function extractStrokes(node: SceneNode): BorderInfo[] | undefined {
  if (!('strokes' in node) || !Array.isArray(node.strokes) || node.strokes.length === 0) {
    return undefined;
  }

  const strokes: BorderInfo[] = [];

  for (const paint of node.strokes) {
    if (paint.type === 'SOLID') {
      strokes.push({
        color: rgbToColorValue(paint.color, paint.opacity ?? 1),
        weight: 'strokeWeight' in node && typeof node.strokeWeight === 'number' ? node.strokeWeight : 1,
        align: 'strokeAlign' in node ? String(node.strokeAlign) : 'INSIDE',
        dashPattern: 'dashPattern' in node && Array.isArray(node.dashPattern) ? [...node.dashPattern] : [],
      });
    }
  }

  return strokes.length > 0 ? strokes : undefined;
}

function extractEffects(node: SceneNode): EffectInfo[] | undefined {
  if (!('effects' in node) || !Array.isArray(node.effects) || node.effects.length === 0) {
    return undefined;
  }

  const effects: EffectInfo[] = [];

  for (const effect of node.effects) {
    effects.push({
      type: effect.type,
      visible: effect.visible,
      radius: 'radius' in effect ? effect.radius : undefined,
      color: effect.type !== 'INNER_SHADOW' && 'color' in effect ? rgbToColorValue(effect.color, effect.color.a) : undefined,
      offset: 'offset' in effect ? { x: effect.offset.x, y: effect.offset.y } : undefined,
      spread: 'spread' in effect ? effect.spread : undefined,
    });
  }

  return effects.length > 0 ? effects : undefined;
}

function extractCornerRadius(node: SceneNode): CornerRadiusInfo | undefined {
  if (!('cornerRadius' in node)) {
    return undefined;
  }

  if (typeof node.cornerRadius !== 'number' && node.cornerRadius !== figma.mixed) {
    return undefined;
  }

  if (node.cornerRadius === figma.mixed) {
    if (!('topLeftRadius' in node)) return undefined;
    return {
      topLeft: node.topLeftRadius,
      topRight: node.topRightRadius,
      bottomRight: node.bottomRightRadius,
      bottomLeft: node.bottomLeftRadius,
      uniform: false,
    };
  }

  return {
    topLeft: node.cornerRadius,
    topRight: node.cornerRadius,
    bottomRight: node.cornerRadius,
    bottomLeft: node.cornerRadius,
    uniform: true,
  };
}

function extractPadding(node: SceneNode): SpacingValue | undefined {
  if (!('paddingTop' in node)) {
    return undefined;
  }

  const spacing: SpacingValue = {
    top: node.paddingTop,
    right: node.paddingRight,
    bottom: node.paddingBottom,
    left: node.paddingLeft,
  };

  if (spacing.top + spacing.right + spacing.bottom + spacing.left === 0) {
    return undefined;
  }

  return spacing;
}

function getComponentId(node: SceneNode): string | undefined {
  if (node.type === 'INSTANCE') {
    return node.mainComponent?.id ?? undefined;
  }
  if (node.type === 'COMPONENT') {
    return node.id;
  }
  return undefined;
}

function getComponentName(node: SceneNode): string | undefined {
  if (node.type === 'INSTANCE') {
    return node.mainComponent?.name ?? node.name;
  }
  if (node.type === 'COMPONENT') {
    return node.name;
  }
  return undefined;
}

function extractVariantProperties(node: SceneNode): ComponentVariantProperty[] | undefined {
  if (node.type !== 'INSTANCE' || !node.variantProperties) {
    return undefined;
  }

  return Object.entries(node.variantProperties).map(([name, value]) => ({
    name,
    value: String(value),
  }));
}

async function extractVariables(node: SceneNode): Promise<VariableBinding[] | undefined> {
  const aliases = getBoundVariables(node);
  if (aliases.length === 0) {
    return undefined;
  }

  const bindings: VariableBinding[] = [];

  for (const alias of aliases) {
    try {
      const variable = await figma.variables.getVariableByIdAsync(alias.id);
      if (!variable) continue;

      let collectionName: string | undefined;
      try {
        const collection = await figma.variables.getVariableCollectionByIdAsync(
          variable.variableCollectionId,
        );
        collectionName = collection?.name;
      } catch {
        collectionName = undefined;
      }

      bindings.push({
        id: variable.id,
        name: variable.name,
        collectionName,
        resolvedType: variable.resolvedType,
      });
    } catch {
      // Variable may be deleted or inaccessible
    }
  }

  return bindings.length > 0 ? bindings : undefined;
}

function extractAssets(node: SceneNode, context: ParseContext): AssetReference[] | undefined {
  const assets: AssetReference[] = [];
  const bounds = getBounds(node);

  if (
    node.type === 'VECTOR' ||
    node.type === 'BOOLEAN_OPERATION' ||
    node.type === 'STAR' ||
    node.type === 'LINE' ||
    node.type === 'POLYGON' ||
    node.type === 'ELLIPSE'
  ) {
    if (bounds.width > 0.01 && bounds.height > 0.01) {
      const icon: AssetReference = {
        id: node.id,
        name: node.name,
        format: 'vector',
        role: 'icon-vector',
        width: bounds.width,
        height: bounds.height,
        bounds,
        cropped: true,
      };
      context.iconMap.set(node.id, icon);
      assets.push(icon);
    }
  }

  if ('fills' in node && Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.type !== 'IMAGE' || fill.visible === false) {
        continue;
      }
        const image: AssetReference = {
          id: node.id,
          name: node.name,
          hash: fill.imageHash ?? undefined,
          format: 'image',
          role: 'image',
          width: bounds.width,
          height: bounds.height,
          bounds,
          cropped: true,
          scaleMode: String(fill.scaleMode),
          imageTransform: fill.imageTransform ? serializeTransform(fill.imageTransform) : undefined,
        };
        context.imageMap.set(`${node.id}:${fill.imageHash ?? 'image'}`, image);
        assets.push(image);
    }
  }

  return assets.length > 0 ? assets : undefined;
}

function serializeTransform(transform: Transform): number[][] {
  return transform.map((row) => [...row]);
}

function collectTokensFromNode(node: SceneNode, context: ParseContext): void {
  const fills = extractFills(node);
  if (fills) {
    for (const fill of fills) {
      const key = fill.hex;
      if (!context.colorMap.has(key)) {
        context.colorMap.set(key, {
          id: key,
          name: key,
          value: fill,
        });
      }
    }
  }

  if (node.type === 'COMPONENT' || node.type === 'INSTANCE') {
    const componentId = getComponentId(node) ?? node.id;
    const existing = context.componentMap.get(componentId);
    const variantProperties = extractVariantProperties(node) ?? [];

    context.componentMap.set(componentId, {
      id: componentId,
      name: getComponentName(node) ?? node.name,
      description: node.type === 'COMPONENT' ? node.description : existing?.description,
      variantCount: (existing?.variantCount ?? 0) + (variantProperties.length > 0 ? 1 : 0),
      propertyNames: mergeUnique(existing?.propertyNames ?? [], variantProperties.map((p) => p.name)),
    });
  }
}

function mergeUnique(existing: string[], values: string[]): string[] {
  return Array.from(new Set([...existing, ...values]));
}

function buildMetadata(
  screens: ParsedScreen[],
  componentMap: Map<string, ComponentSummary>,
  imageMap: Map<string, AssetReference>,
): DesignMetadata {
  let textElementCount = 0;
  let nodeCount = 0;

  const countInTree = (node: ParsedNode): void => {
    nodeCount += 1;
    if (node.semanticType === 'Text') {
      textElementCount += 1;
    }
    node.children.forEach(countInTree);
  };

  screens.forEach((screen) => countInTree(screen.root));

  return {
    screenCount: screens.length,
    componentCount: componentMap.size,
    imageCount: imageMap.size,
    textElementCount,
    nodeCount,
    figmaFileName: figma.root.name,
    figmaPageName: figma.currentPage.name,
  };
}

/**
 * Infers a semantic node type from Figma node characteristics.
 */
export function inferSemanticType(node: SceneNode, isRoot: boolean): ParsedNode['semanticType'] {
  if (isRoot) {
    return 'Screen';
  }

  const name = node.name.toLowerCase();

  if (node.type === 'TEXT') return 'Text';
  if (node.type === 'INSTANCE' || node.type === 'COMPONENT') return 'Component';
  if (node.type === 'SECTION') return 'Section';

  if (name.includes('button') || name.includes('btn')) return 'Button';
  if (name.includes('input') || name.includes('field') || name.includes('textfield')) return 'Input';
  if (name.includes('avatar')) return 'Avatar';
  if (name.includes('icon')) return 'Icon';
  if (name.includes('image') || name.includes('photo') || name.includes('thumbnail')) return 'Image';
  if (name.includes('card')) return 'Card';
  if (name.includes('nav') || name.includes('navigation') || name.includes('tab bar')) return 'Navigation';
  if (name.includes('divider') || name.includes('separator')) return 'Divider';
  if (name.includes('list')) return 'List';
  if (name.includes('grid')) return 'Grid';

  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    return 'Container';
  }

  if (node.type === 'FRAME') return 'Frame';
  if (node.type === 'GROUP') return 'Group';

  return 'Unknown';
}

export { hasVisibleContent };
