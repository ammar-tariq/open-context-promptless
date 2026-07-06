import type { ParsedScreen } from '@/types';
import type { ExportOptions, VariantExportMode } from '@/types/map';
import { buildScreenSlugMap, normalizeScreenName } from '@/utils/screen-slug';
import { countParsedNodes } from '@/map/map-builder';

export interface DuplicateScreenGroup {
  name: string;
  normalizedName: string;
  screens: Array<{
    id: string;
    name: string;
    nodeCount: number;
  }>;
}

export interface VariantResolutionResult {
  selectedScreens: ParsedScreen[];
  skippedScreens: ParsedScreen[];
  slugByScreenId: Map<string, string>;
  variants: Record<string, { canonical: string; canonicalSlug: string; skipped: Array<{ id: string; slug: string; name: string }> }>;
  skippedVariantCount: number;
}

export function findDuplicateScreenGroups(
  screens: Array<{ id: string; name: string; nodeCount: number }>,
): DuplicateScreenGroup[] {
  const groups = new Map<string, DuplicateScreenGroup>();

  for (const screen of screens) {
    const normalizedName = normalizeScreenName(screen.name);
    const existing = groups.get(normalizedName);

    if (existing) {
      existing.screens.push(screen);
      continue;
    }

    groups.set(normalizedName, {
      name: screen.name,
      normalizedName,
      screens: [screen],
    });
  }

  return Array.from(groups.values()).filter((group) => group.screens.length > 1);
}

export function resolveScreenVariants(
  screens: ParsedScreen[],
  options: ExportOptions,
): VariantResolutionResult {
  const grouped = new Map<string, ParsedScreen[]>();

  for (const screen of screens) {
    const key = normalizeScreenName(screen.name);
    const bucket = grouped.get(key) ?? [];
    bucket.push(screen);
    grouped.set(key, bucket);
  }

  const selected: ParsedScreen[] = [];
  const skipped: ParsedScreen[] = [];
  const variants: VariantResolutionResult['variants'] = {};

  for (const [normalizedName, group] of grouped) {
    if (group.length === 1) {
      const only = group[0];
      if (only) selected.push(only);
      continue;
    }

  const chosen = pickCanonicalScreen(group, options, normalizedName);
    const groupSkipped = group.filter((screen) => screen.id !== chosen.id);
    selected.push(chosen);
    skipped.push(...groupSkipped);

    const allSlugs = buildScreenSlugMap(group.map((s) => ({ id: s.id, name: s.name })));
    variants[normalizedName] = {
      canonical: chosen.id,
      canonicalSlug: allSlugs.get(chosen.id) ?? chosen.id,
      skipped: groupSkipped.map((screen) => ({
        id: screen.id,
        slug: allSlugs.get(screen.id) ?? screen.id,
        name: screen.name,
      })),
    };
  }

  if (options.variantMode === 'all') {
    return {
      selectedScreens: screens,
      skippedScreens: [],
      slugByScreenId: buildScreenSlugMap(screens.map((s) => ({ id: s.id, name: s.name }))),
      variants: {},
      skippedVariantCount: 0,
    };
  }

  const slugByScreenId = buildScreenSlugMap(selected.map((s) => ({ id: s.id, name: s.name })));

  return {
    selectedScreens: selected,
    skippedScreens: skipped,
    slugByScreenId,
    variants,
    skippedVariantCount: skipped.length,
  };
}

function pickCanonicalScreen(
  group: ParsedScreen[],
  options: ExportOptions,
  normalizedName: string,
): ParsedScreen {
  if (options.variantMode === 'custom' && options.canonicalOverrides?.[normalizedName]) {
    const overrideId = options.canonicalOverrides[normalizedName];
    const override = group.find((screen) => screen.id === overrideId);
    if (override) {
      return override;
    }
  }

  return [...group].sort((a, b) => countParsedNodes(b.root) - countParsedNodes(a.root))[0]!;
}

export function countFigmaNodes(node: SceneNode): number {
  let count = 1;
  if ('children' in node) {
    for (const child of node.children) {
      count += countFigmaNodes(child);
    }
  }
  return count;
}

export function defaultVariantMode(): VariantExportMode {
  return 'canonical';
}
