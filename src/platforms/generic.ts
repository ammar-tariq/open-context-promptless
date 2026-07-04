import type { ParsedDesign } from '@/types';
import type { SemanticDesign } from '@/types/semantic';
import type { PlatformAdapter } from './types';

export const genericPlatformAdapter: PlatformAdapter = {
  id: 'generic',
  label: 'General',
  status: 'supported',

  enhanceSemantic(semantic: SemanticDesign, design: ParsedDesign): SemanticDesign {
    return {
      ...semantic,
      platform: {
        id: 'generic',
        label: 'General',
        status: 'supported',
        description:
          'Framework-agnostic export. Use navigation.links for screen-to-screen flows in any stack.',
        navigationNotes: buildGenericNavigationNotes(design),
      },
    };
  },
};

function buildGenericNavigationNotes(design: ParsedDesign): string[] {
  const notes = [
    'Prototype links are exported in navigation.links with source/destination screen IDs and node names.',
    'Map each exported screen to a route or view in your target framework.',
  ];

  if (design.navigation.linkCount === 0) {
    notes.push('No prototype links were found on the exported screens.');
  } else {
    notes.push(
      `${design.navigation.linkCount} prototype link(s) were exported from Figma interactions.`,
    );
  }

  return notes;
}
