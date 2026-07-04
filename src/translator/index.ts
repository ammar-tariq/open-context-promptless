import type { ExportTargetId } from '@/constants/export-targets';
import type { ParsedDesign, ParsedNode, ParsedScreen, TypographyStyle } from '@/types';
import type { SemanticDesign, SemanticNode, SemanticTextContent } from '@/types/semantic';

/**
 * Translates parsed Figma data into a semantic, framework-agnostic representation.
 */
export function translateDesign(
  parsed: ParsedDesign,
  exportTargetId: ExportTargetId = 'generic',
): SemanticDesign {
  return {
    exportTarget: exportTargetId,
    project: {
      name: parsed.projectName,
      exportedAt: parsed.exportedAt,
      pluginVersion: parsed.pluginVersion,
    },
    metadata: {
      figmaFileName: parsed.metadata.figmaFileName,
      figmaPageName: parsed.metadata.figmaPageName,
      exportedFrom: 'OpenContext Figma Plugin',
    },
    screens: parsed.screens.map(translateScreen),
    navigation: {
      links: parsed.navigation.links.map((link) => ({ ...link })),
      linkCount: parsed.navigation.linkCount,
    },
    components: parsed.components.map((component) => ({
      id: component.id,
      name: component.name,
      description: component.description ?? null,
      variantCount: component.variantCount,
      properties: component.propertyNames,
    })),
    tokens: {
      colors: parsed.colors.map((color) => ({
        id: color.id,
        name: color.name,
        value: color.value,
      })),
      typography: parsed.typography.map((style, index) => ({
        id: `typography-${index + 1}`,
        ...translateTypography(style),
      })),
      fonts: parsed.typography.map((style, index) => ({
        id: `font-${index + 1}`,
        family: style.fontFamily,
        style: style.fontStyle,
        weight: style.fontWeight,
        size: style.fontSize,
      })),
      spacing: collectSpacingTokens(parsed.screens),
    },
    assets: {
      images: parsed.images.map(toAssetRecord),
      icons: parsed.icons.map(toAssetRecord),
    },
    summary: {
      screenCount: parsed.metadata.screenCount,
      componentCount: parsed.metadata.componentCount,
      imageCount: parsed.metadata.imageCount,
      iconCount: parsed.icons.length,
      exportedAssetCount: countExportedAssets(parsed.images, parsed.icons),
      textElementCount: parsed.metadata.textElementCount,
      nodeCount: parsed.metadata.nodeCount,
      navigationLinkCount: parsed.navigation.linkCount,
    },
  };
}

function toAssetRecord(asset: ParsedDesign['images'][number]): Record<string, unknown> {
  return {
    id: asset.id,
    name: asset.name,
    role: asset.role ?? null,
    hash: asset.hash ?? null,
    format: asset.format ?? null,
    exportPath: asset.exportPath ?? null,
    rasterExportPath: asset.rasterExportPath ?? null,
    mimeType: asset.mimeType ?? null,
    rasterMimeType: asset.rasterMimeType ?? null,
    width: asset.width ?? null,
    height: asset.height ?? null,
    cropped: asset.cropped ?? null,
    bounds: asset.bounds ?? null,
    scaleMode: asset.scaleMode ?? null,
    imageTransform: asset.imageTransform ?? null,
  };
}

function countExportedAssets(
  images: ParsedDesign['images'],
  icons: ParsedDesign['icons'],
): number {
  const exported = new Set<string>();

  for (const asset of [...images, ...icons]) {
    if (asset.exportPath) {
      exported.add(asset.exportPath);
    }
    if (asset.rasterExportPath) {
      exported.add(asset.rasterExportPath);
    }
  }

  return exported.size;
}

function translateTypography(style: TypographyStyle): Record<string, unknown> {
  return {
    fontFamily: style.fontFamily,
    fontStyle: style.fontStyle,
    fontWeight: style.fontWeight,
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    textAlignHorizontal: style.textAlignHorizontal,
    textAlignVertical: style.textAlignVertical,
    textDecoration: style.textDecoration,
    textCase: style.textCase,
    mixed: style.mixed ?? false,
  };
}

function translateText(node: ParsedNode): SemanticTextContent | undefined {
  if (!node.textContent) {
    return undefined;
  }

  const text: SemanticTextContent = {
    content: node.textContent,
  };

  if (node.typography) {
    text.typography = translateTypography(node.typography);
    if (node.typography.segments && node.typography.segments.length > 0) {
      text.segments = node.typography.segments.map((segment) => ({
        start: segment.start,
        end: segment.end,
        characters: segment.characters,
        fontFamily: segment.fontFamily,
        fontStyle: segment.fontStyle,
        fontWeight: segment.fontWeight,
        fontSize: segment.fontSize,
        lineHeight: segment.lineHeight,
        letterSpacing: segment.letterSpacing,
        textDecoration: segment.textDecoration,
        textCase: segment.textCase,
        color: segment.color ?? null,
      }));
    }
  }

  return text;
}

function translateScreen(screen: ParsedScreen): SemanticNode {
  return translateNode(screen.root, screen.name);
}

function translateNode(node: ParsedNode, screenName?: string): SemanticNode {
  const semantic: SemanticNode = {
    id: node.metadata.figmaId,
    type: node.semanticType,
    name: node.metadata.name,
    bounds: node.bounds,
    children: node.children.map((child) => translateNode(child)),
  };

  if (node.layout) {
    semantic.layout = {
      autoLayout: node.layout,
    };
  }

  if (node.constraints) {
    semantic.constraints = { ...node.constraints };
  }

  if (node.typography && node.semanticType !== 'Text') {
    semantic.typography = translateTypography(node.typography);
  }

  if (node.fills && node.fills.length > 0) {
    semantic.colors = {
      fills: node.fills,
    };
  }

  if (node.spacing) {
    semantic.spacing = { padding: node.spacing };
  }

  if (node.strokes) {
    semantic.borders = node.strokes.map((stroke) => ({ ...stroke }));
  }

  if (node.effects) {
    semantic.effects = node.effects.map((effect) => ({ ...effect }));
  }

  if (node.cornerRadius) {
    semantic.cornerRadius = { ...node.cornerRadius };
  }

  if (node.variables) {
    semantic.variables = node.variables.map((variable) => ({ ...variable }));
  }

  const text = translateText(node);
  if (text) {
    semantic.text = text;
  }

  if (node.componentId) {
    semantic.component = {
      id: node.componentId,
      name: node.componentName ?? node.metadata.name,
      isInstance: node.isInstance ?? false,
      variants: node.variantProperties
        ? Object.fromEntries(node.variantProperties.map((prop) => [prop.name, prop.value]))
        : undefined,
    };
  }

  if (node.assets) {
    semantic.assets = node.assets.map((asset) => toAssetRecord(asset));
  }

  semantic.metadata = {
    figmaType: node.metadata.figmaType,
    visible: node.metadata.visible,
    locked: node.metadata.locked,
    opacity: node.metadata.opacity,
    blendMode: node.metadata.blendMode,
    screenName,
  };

  return semantic;
}

function collectSpacingTokens(screens: ParsedScreen[]): Record<string, unknown>[] {
  const values = new Set<number>();

  const walk = (node: ParsedNode): void => {
    if (node.layout?.itemSpacing !== undefined) {
      values.add(node.layout.itemSpacing);
    }
    if (node.layout?.padding) {
      Object.values(node.layout.padding).forEach((value) => values.add(value));
    }
    if (node.spacing) {
      Object.values(node.spacing).forEach((value) => values.add(value));
    }
    node.children.forEach(walk);
  };

  screens.forEach((screen) => walk(screen.root));

  return Array.from(values)
    .sort((a, b) => a - b)
    .map((value, index) => ({
      id: `spacing-${index + 1}`,
      value,
      unit: 'px',
    }));
}
