import type { SemanticDesign } from '@/types/semantic';
import { slugify } from '@/utils';

export interface NavigationWiringEntry {
  id: string;
  fromSlug: string;
  fromRoute: string;
  fromScreenName: string;
  sourceNodeId: string;
  sourceNodeName: string;
  toSlug: string | null;
  toRoute: string | null;
  toScreenName: string | null;
  trigger: string;
  handler: string;
  elementHint: string;
}

export interface NavigationWiringManifest {
  linkCount: number;
  entries: NavigationWiringEntry[];
}

function slugFromScreenName(name: string): string {
  return slugify(name) || name.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Flat navigation wiring table for agents — one row per prototype link.
 */
export function buildNavigationWiring(semantic: SemanticDesign): NavigationWiringManifest {
  const platform = semantic.platform ?? {};
  const linkMappings =
    (platform.linkMappings as Array<Record<string, unknown>> | undefined) ?? [];

  const entries: NavigationWiringEntry[] = linkMappings.map((link) => {
    const fromScreenName = String(link.fromScreenName ?? '');
    const toScreenName = link.toScreenName ? String(link.toScreenName) : null;

    return {
      id: String(link.id ?? ''),
      fromSlug: slugFromScreenName(fromScreenName),
      fromRoute: String(link.fromRoute ?? ''),
      fromScreenName,
      sourceNodeId: String(link.sourceNodeId ?? ''),
      sourceNodeName: String(link.sourceNodeName ?? 'Element'),
      toSlug: toScreenName ? slugFromScreenName(toScreenName) : null,
      toRoute: link.toRoute ? String(link.toRoute) : null,
      toScreenName,
      trigger: String(link.trigger ?? 'ON_CLICK'),
      handler: link.reactNavigation ? String(link.reactNavigation) : 'navigation.navigate(...)',
      elementHint: String(link.elementHint ?? ''),
    };
  });

  return {
    linkCount: entries.length,
    entries,
  };
}
