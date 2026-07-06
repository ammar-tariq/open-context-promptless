import type { ExportTargetId } from '@/constants/export-targets';
import type { ParsedDesign } from '@/types';
import type { SemanticDesign } from '@/types/semantic';
import type { ScreenCatalogEntry, VariantGroupEntry } from '@/types/map';
import { toRouteName } from '@/utils/route-names';
import {
  generateGenericAgentsMd,
  generateGenericBuildMd,
  generateGenericPhaseFiles,
} from './generic';
import {
  generateReactNativeAgentsMd,
  generateReactNativeBuildMd,
  generateReactNativePhaseFiles,
} from './react-native';

export {
  generateGenericAgentsMd,
  generateGenericBuildMd,
  generateGenericPhaseFiles,
} from './generic';
export {
  generateReactNativeAgentsMd,
  generateReactNativeBuildMd,
  generateReactNativePhaseFiles,
} from './react-native';

function resolveExportTarget(semantic: SemanticDesign): ExportTargetId {
  return semantic.exportTarget === 'react-native' ? 'react-native' : 'generic';
}

export function generateBuildMd(
  semantic: SemanticDesign,
  catalog: ScreenCatalogEntry[],
): string {
  return resolveExportTarget(semantic) === 'react-native'
    ? generateReactNativeBuildMd(semantic, catalog)
    : generateGenericBuildMd(semantic, catalog);
}

export function generateAgentsMd(semantic: SemanticDesign): string {
  return resolveExportTarget(semantic) === 'react-native'
    ? generateReactNativeAgentsMd(semantic)
    : generateGenericAgentsMd(semantic);
}

export function generatePhaseFiles(
  semantic: SemanticDesign,
  design: ParsedDesign,
  catalog: ScreenCatalogEntry[],
): Record<string, string> {
  return resolveExportTarget(semantic) === 'react-native'
    ? generateReactNativePhaseFiles(semantic, design, catalog)
    : generateGenericPhaseFiles(semantic, design, catalog);
}

export function buildCatalogEntries(
  screens: Array<{ id: string; name: string; bounds: { width: number; height: number } }>,
  slugByScreenId: Map<string, string>,
): ScreenCatalogEntry[] {
  return screens.map((screen) => {
    const slug = slugByScreenId.get(screen.id) ?? screen.id;
    return {
      id: slug,
      slug,
      name: screen.name,
      figmaId: screen.id,
      route: toRouteName(screen.name),
      paths: {
        map: `screens/${slug}/map.json`,
        reference: `screens/${slug}/reference.png`,
        meta: `screens/${slug}/meta.json`,
      },
      frame: {
        width: Math.round(screen.bounds.width),
        height: Math.round(screen.bounds.height),
      },
    };
  });
}

export function buildVariantsJson(
  variants: Record<
    string,
    {
      canonical: string;
      canonicalSlug: string;
      skipped: Array<{ id: string; slug: string; name: string }>;
    }
  >,
): Record<string, VariantGroupEntry> {
  const result: Record<string, VariantGroupEntry> = {};

  for (const [key, value] of Object.entries(variants)) {
    result[key] = {
      canonical: value.canonical,
      canonicalSlug: value.canonicalSlug,
      skipped: value.skipped,
    };
  }

  return result;
}
