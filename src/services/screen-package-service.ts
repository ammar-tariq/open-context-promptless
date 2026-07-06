import type { ContextPackageFile, ParsedDesign } from '@/types';
import type { SemanticDesign } from '@/types/semantic';
import type { ExportOptions, ScreenCatalogEntry } from '@/types/map';
import { buildScreenMap } from '@/map/map-builder';
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
import { generatePromptMd } from '@/utils/starter-prompt';
import type { ExportProgressHandler } from './export-service';

export interface ScreenPackageInput {
  design: ParsedDesign;
  semantic: SemanticDesign;
  nodes: SceneNode[];
  options: ExportOptions;
  onProgress?: ExportProgressHandler;
}

export interface ScreenPackageResult {
  files: ContextPackageFile[];
  catalog: ScreenCatalogEntry[];
  skippedVariantCount: number;
  exportedScreenCount: number;
}

/**
 * Builds per-screen maps, reference images, catalog, and agent orchestration files.
 */
export async function buildScreenPackage(input: ScreenPackageInput): Promise<ScreenPackageResult> {
  const { design, semantic, nodes, options, onProgress } = input;

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const resolution = resolveScreenVariants(design.screens, options);
  const { selectedScreens, slugByScreenId, variants, skippedVariantCount } = resolution;

  const screenNodes = selectedScreens
    .map((screen) => {
      const node = nodeById.get(screen.id);
      return node ? { bounds: screen.bounds, node } : null;
    })
    .filter((entry): entry is { bounds: ParsedDesign['screens'][0]['bounds']; node: SceneNode } => entry !== null);

  const contentArea = detectGlobalContentArea(screenNodes);
  const files: ContextPackageFile[] = [];
  const semanticById = new Map(semantic.screens.map((screen) => [screen.id, screen]));

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
    });

    files.push({
      path: `screens/${slug}/map.json`,
      content: JSON.stringify(map, null, 2),
    });

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

  const catalog = buildCatalogEntries(selectedScreens, slugByScreenId);

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
    }),
  });

  const phases = generatePhaseFiles(semantic, design, catalog);
  for (const [path, content] of Object.entries(phases)) {
    files.push({ path, content });
  }

  return {
    files,
    catalog,
    skippedVariantCount,
    exportedScreenCount: selectedScreens.length,
  };
}
