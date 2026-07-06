import type { ContextPackageFile, ParsedDesign } from '@/types';
import type { SemanticDesign } from '@/types/semantic';
import type { ExportOptions, ScreenCatalogEntry, ScreenMap, ScreenSpec } from '@/types/map';
import { buildAssetManifest, buildRegistryScaffold } from '@/map/asset-manifest-builder';
import { buildScreenMap, collectViewKinds } from '@/map/map-builder';
import {
  buildScreenAssetsManifest,
  buildScreenDecorativeManifest,
} from '@/map/screen-assets-builder';
import { buildLayerOrder } from '@/map/layer-order-builder';
import { buildImplementationStub } from '@/map/implementation-stub-builder';
import { buildGoldenSignInExample, pickGoldenExampleSource } from '@/map/golden-example-builder';
import { buildNavigationWiring } from '@/map/navigation-wiring-builder';
import { buildScreenSpec, buildVariantGroups } from '@/map/screen-spec-builder';
import {
  buildCatalogEntries,
  buildVariantsJson,
  generateAgentsMd,
  generateBuildMd,
  generatePhaseFiles,
} from '@/exporters/orchestration-content';
import { exportScreenReference } from '@/services/screen-export-service';
import { detectGlobalContentArea } from '@/utils/status-bar';
import { resolveScreenVariants } from '@/services/variant-resolution-service';
import type { ExportTargetId } from '@/constants/export-targets';
import type { SkippedAssetExport } from '@/services/asset-export-service';
import {
  generateReactNativePackagesJson,
  generateReactNativeViewsJson,
} from '@/platform/react-native/view-dictionary';
import { generateReactNativeFontsJson } from '@/platform/react-native/font-mapping';
import { CHECK_VISUAL_SHORTCUTS_SCRIPT } from '@/export-scripts/check-visual-shortcuts';
import { generatePromptMd } from '@/utils/starter-prompt';
import type { ExportProgressHandler } from './export-service';

export interface ScreenPackageInput {
  design: ParsedDesign;
  semantic: SemanticDesign;
  nodes: SceneNode[];
  options: ExportOptions;
  exportTarget: ExportTargetId;
  skippedAssets?: SkippedAssetExport[];
  onProgress?: ExportProgressHandler;
}

export interface ScreenPackageResult {
  files: ContextPackageFile[];
  catalog: ScreenCatalogEntry[];
  specs: ScreenSpec[];
  maps: ScreenMap[];
  screenAssetsManifests: ReturnType<typeof buildScreenAssetsManifest>[];
  skippedVariantCount: number;
  exportedScreenCount: number;
  uniqueScreenNameCount: number;
}

/**
 * Builds per-screen maps, reference images, catalog, and agent orchestration files.
 */
export async function buildScreenPackage(input: ScreenPackageInput): Promise<ScreenPackageResult> {
  const { design, semantic, nodes, options, exportTarget, onProgress } = input;
  const rasterOnly = exportTarget === 'react-native';

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const resolution = resolveScreenVariants(design.screens, options);
  const { selectedScreens, slugByScreenId, variants, skippedVariantCount } = resolution;

  const allSlugs = selectedScreens.map((screen) => slugByScreenId.get(screen.id) ?? screen.id);

  const screenNodes = selectedScreens
    .map((screen) => {
      const node = nodeById.get(screen.id);
      return node ? { bounds: screen.bounds, node } : null;
    })
    .filter((entry): entry is { bounds: ParsedDesign['screens'][0]['bounds']; node: SceneNode } => entry !== null);

  const contentArea = detectGlobalContentArea(screenNodes);
  const files: ContextPackageFile[] = [];
  const semanticById = new Map(semantic.screens.map((screen) => [screen.id, screen]));
  const specs: ScreenSpec[] = [];
  const maps: ScreenMap[] = [];
  const screenAssetsManifests = [];
  const copiesBySlug = new Map<string, ReturnType<typeof buildScreenSpec>['copy']>();

  const variantGroups = buildVariantGroups(
    selectedScreens.map((screen) => ({
      name: screen.name,
      slug: slugByScreenId.get(screen.id) ?? screen.id,
    })),
  );

  const total = selectedScreens.length;

  for (let index = 0; index < selectedScreens.length; index++) {
    const screen = selectedScreens[index]!;
    const slug = slugByScreenId.get(screen.id) ?? screen.id;
    const figmaNode = nodeById.get(screen.id);
    const semanticScreen = semanticById.get(screen.id);

    onProgress?.(`Building map ${index + 1} of ${total}: ${screen.name}`, 0.9 + (index / total) * 0.06);

    if (!semanticScreen) {
      continue;
    }

    const map = buildScreenMap(screen, semanticScreen, {
      slug,
      contentArea,
      figmaNode,
      rasterOnly,
      allSlugs,
    });

    maps.push(map);

    const { spec, copy } = buildScreenSpec({
      map,
      slug,
      variantGroups,
      allSlugs,
    });

    specs.push(spec);
    copiesBySlug.set(slug, copy);

    const layerOrder = buildLayerOrder(map);
    const stub = buildImplementationStub(map, copy, layerOrder);

    const assetsManifest = buildScreenAssetsManifest(map);
    screenAssetsManifests.push(assetsManifest);
    const decorativeManifest = buildScreenDecorativeManifest(map);

    files.push({
      path: `screens/${slug}/map.json`,
      content: JSON.stringify(map, null, 2),
    });

    files.push({
      path: `screens/${slug}/spec.json`,
      content: JSON.stringify(spec, null, 2),
    });

    files.push({
      path: `screens/${slug}/copy.json`,
      content: JSON.stringify(copy, null, 2),
    });

    files.push({
      path: `screens/${slug}/layer-order.json`,
      content: JSON.stringify(layerOrder, null, 2),
    });

    files.push({
      path: `implementation-stubs/${slug}.tsx`,
      content: stub,
    });

    files.push({
      path: `screens/${slug}/assets.json`,
      content: JSON.stringify(assetsManifest, null, 2),
    });

    if (decorativeManifest.layers.length > 0) {
      files.push({
        path: `screens/${slug}/decorative.json`,
        content: JSON.stringify(decorativeManifest, null, 2),
      });
    }

    files.push({
      path: `screens/${slug}/meta.json`,
      content: JSON.stringify(
        {
          id: slug,
          name: screen.name,
          figmaId: screen.id,
          route: map.screen.route,
          frame: map.screen.frame,
          contentArea: map.screen.contentArea,
          reference: map.reference,
          screenKind: spec.screenKind,
          layoutPattern: spec.layoutPattern,
          variantOf: spec.variantOf,
          variantNote: spec.variantNote,
          backgroundColor: spec.backgroundColor,
          viewKindsUsed: spec.viewKindsUsed,
          paths: {
            map: `screens/${slug}/map.json`,
            spec: `screens/${slug}/spec.json`,
            copy: `screens/${slug}/copy.json`,
            assets: `screens/${slug}/assets.json`,
            decorative: `screens/${slug}/decorative.json`,
            layerOrder: `screens/${slug}/layer-order.json`,
            stub: `implementation-stubs/${slug}.tsx`,
            reference: `screens/${slug}/reference.png`,
          },
        },
        null,
        2,
      ),
    });

    if (figmaNode) {
      onProgress?.(`Exporting reference ${index + 1} of ${total}`, 0.96 + (index / total) * 0.02);
      const reference = await exportScreenReference(figmaNode, slug);
      files.push({
        path: reference.path,
        content: reference.content,
        encoding: reference.encoding,
      });
    }
  }

  const specsBySlug = new Map(specs.map((spec) => [spec.slug, spec]));
  const catalog = buildCatalogEntries(selectedScreens, slugByScreenId, specsBySlug);

  const assetManifest = buildAssetManifest(screenAssetsManifests, design, exportTarget);
  files.push({
    path: 'assets/manifest.json',
    content: JSON.stringify(assetManifest, null, 2),
  });

  files.push({
    path: 'assets/registry-scaffold.ts',
    content: buildRegistryScaffold(assetManifest),
  });

  if (exportTarget === 'react-native') {
    files.push({
      path: 'platform/react-native/views.json',
      content: generateReactNativeViewsJson(),
    });

    files.push({
      path: 'platform/react-native/packages.json',
      content: generateReactNativePackagesJson(),
    });

    files.push({
      path: 'platform/react-native/fonts.json',
      content: generateReactNativeFontsJson(design.typography),
    });

    files.push({
      path: 'scripts/check-visual-shortcuts.mjs',
      content: CHECK_VISUAL_SHORTCUTS_SCRIPT,
    });

    const goldenSource = pickGoldenExampleSource(specs);
    if (goldenSource) {
      const goldenMap = maps.find((entry) => entry.screen.slug === goldenSource.slug);
      const goldenCopy = copiesBySlug.get(goldenSource.slug);
      if (goldenMap && goldenCopy) {
        const goldenFiles = buildGoldenSignInExample(
          goldenSource.slug,
          goldenMap,
          goldenSource,
          goldenCopy,
        );
        for (const [path, content] of Object.entries(goldenFiles)) {
          files.push({ path, content });
        }
      }
    }
  }

  const wiring = buildNavigationWiring(semantic);
  files.push({
    path: 'navigation/wiring.json',
    content: JSON.stringify(wiring, null, 2),
  });

  files.push({
    path: 'catalog/screens.json',
    content: JSON.stringify({ screens: catalog }, null, 2),
  });

  if (Object.keys(variants).length > 0) {
    files.push({
      path: 'catalog/variants.json',
      content: JSON.stringify(buildVariantsJson(variants), null, 2),
    });
  }

  files.push({
    path: 'catalog/variant-groups.json',
    content: JSON.stringify({ groups: variantGroups }, null, 2),
  });

  files.push({
    path: 'shared/tokens.json',
    content: JSON.stringify(semantic.tokens, null, 2),
  });

  files.push({
    path: 'shared/components.json',
    content: JSON.stringify({ components: semantic.components }, null, 2),
  });

  files.push({
    path: 'navigation/flows.json',
    content: JSON.stringify(
      {
        linkCount: semantic.navigation.linkCount,
        links: semantic.navigation.links,
      },
      null,
      2,
    ),
  });

  files.push({
    path: 'BUILD.md',
    content: generateBuildMd(semantic, catalog),
  });

  files.push({
    path: 'AGENTS.md',
    content: generateAgentsMd(semantic),
  });

  files.push({
    path: 'PROMPT.md',
    content: generatePromptMd({
      projectName: semantic.project.name,
      exportTarget: semantic.exportTarget as ExportTargetId,
      screenCount: catalog.length,
      uniqueScreenNames: variantGroups.length,
      variantMode: options.variantMode,
      skippedVariantCount: skippedVariantCount,
    }),
  });

  const phases = generatePhaseFiles(semantic, design, catalog, specs);
  for (const [path, content] of Object.entries(phases)) {
    files.push({ path, content });
  }

  return {
    files,
    catalog,
    specs,
    maps,
    screenAssetsManifests,
    skippedVariantCount,
    exportedScreenCount: selectedScreens.length,
    uniqueScreenNameCount: variantGroups.length,
  };
}

export { collectViewKinds };
