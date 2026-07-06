import { EXPORT_FILE_NAMES } from '@/constants';
import { formatHumanDate } from '@/utils';
import type { ExportContext } from './base';
import { BaseExporter } from './base';

/**
 * Generates a human-readable README for the exported context package.
 */
export class ReadmeExporter extends BaseExporter {
  readonly id = 'readme';
  readonly fileName = EXPORT_FILE_NAMES.README;

  export(context: ExportContext) {
    const { design, semantic } = context;
    const exportedDate = formatHumanDate(new Date(design.exportedAt));
    const screenNames = design.screens.map((screen) => screen.name).join(', ');
    const platform = semantic.platform ?? {};
    const platformLabel = String(platform.label ?? 'General');
    const navigationLinks = semantic.navigation.links;

    const content = `# ${semantic.project.name}

> AI-ready design context exported from Figma

## Export Details

| Field | Value |
| --- | --- |
| **Project** | ${semantic.project.name} |
| **Export Target** | ${platformLabel} |
| **Exported** | ${exportedDate} |
| **Plugin Version** | ${semantic.project.pluginVersion} |
| **Figma File** | ${design.metadata.figmaFileName} |
| **Figma Page** | ${design.metadata.figmaPageName} |

## Summary

This folder contains a normalized representation of your Figma design, prepared for consumption by AI coding assistants such as Claude Code, Cursor, Codex, GitHub Copilot, Gemini, Ollama, and other local or cloud models.

| Metric | Count |
| --- | ---: |
| Screens | ${semantic.summary.screenCount} |
| Prototype Links | ${semantic.navigation.linkCount} |
| Components | ${semantic.summary.componentCount} |
| Images | ${semantic.summary.imageCount} |
| Icons | ${semantic.summary.iconCount ?? 0} |
| Exported Assets | ${semantic.summary.exportedAssetCount ?? 0} |
| Text Elements | ${semantic.summary.textElementCount} |
| Total Nodes | ${semantic.summary.nodeCount} |

## Exported Screens

${design.screens.length > 0 ? design.screens.map((screen) => `- ${screen.name}`).join('\n') : '_No screens exported._'}

## Screen Navigation

${formatNavigationSection(navigationLinks, semantic.exportTarget)}

## Contents

- \`PROMPT.md\` — Copy-paste kickoff prompt for your AI agent (read after placing \`context/\` in your repo).
- \`BUILD.md\` — Agent entry point: run all implementation phases autonomously.
- \`AGENTS.md\` — Global rules for layout, typography, and QA.
- \`phases/\` — Step-by-step implementation phases (design system → screens → navigation → QA).
- \`catalog/screens.json\` — Canonical screen index with paths to per-screen files.
- \`catalog/variants.json\` — Duplicate screen names and which variants were skipped (when applicable).
- \`screens/{slug}/map.json\` — Design reference map (read while implementing — not a runtime layout format).
- \`screens/{slug}/reference.png\` — Full-frame reference image for visual QA.
- \`screens/{slug}/meta.json\` — Screen metadata (frame size, content area, route).
- \`shared/tokens.json\` — Colors, typography, spacing tokens.
- \`shared/components.json\` — Component summaries.
- \`navigation/flows.json\` — Prototype navigation links.
- \`data.json\` — Full semantic design tree (debug / legacy compatibility).
- \`assets/images/\` — Cropped raster exports for image layers and icon PNGs.
- \`assets/icons/\` — Exported SVG vector icons from the design.
${semantic.exportTarget === 'react-native' ? '- `navigation-notes.md` — React Navigation setup guide with route names and navigate() mappings.' : ''}

${formatPlatformSection(semantic)}

## Usage

1. Create or open your application repository and scaffold the project if needed.
2. Place this \`context/\` folder at \`./context\` in that repository.
3. Select the matching export target in OpenContext when exporting (**React Native** for Expo/RN-specific \`AGENTS.md\` and prompts).
4. Open \`PROMPT.md\`, copy the kickoff prompt, and paste it into Cursor, Claude Code, or your AI agent.
5. The agent should read \`BUILD.md\` and \`AGENTS.md\`, then run all phases without per-screen prompts.
6. Use \`screens/{slug}/map.json\` and \`reference.png\` as **design reference** while implementing each screen.
7. Compare implemented screens to \`screens/{slug}/reference.png\` during QA (phase 05).
8. Reference files in \`assets/\` when implementing images and icons in code.
${semantic.exportTarget === 'react-native' ? '9. Follow `AGENTS.md` for RN folder structure (`src/screens/{slug}/index.tsx`, `styles.ts`, shared `src/components/`). Use `navigation/flows.json` and `navigation-notes.md` for routing.' : '9. For General exports, confirm the target stack in `PROMPT.md` or let the agent ask once before implementing.'}

## Notes

- This package describes design intent; it does not contain generated application code.
- Screen names included in this export: ${screenNames || 'N/A'}.
- Prototype links from Figma are exported in \`data.json\` under \`navigation.links\`.
- Text nodes include resolved font families, styles, weights, and per-segment typography in \`data.json\`.
- Exported assets are cropped to their Figma layer bounds and written to \`assets/images\` and \`assets/icons\`.
- Future OpenContext versions may add additional export targets such as Flutter and SwiftUI.

---

Generated by [OpenContext](https://github.com/opencontext) v${semantic.project.pluginVersion}.
`;

    return this.buildFile(content);
  }
}

function formatNavigationSection(
  links: Record<string, unknown>[],
  exportTarget: string,
): string {
  if (links.length === 0) {
    return '_No prototype links were found on the exported screens._';
  }

  const lines = links.map((link) => {
    const from = String(link.sourceScreenName ?? 'Unknown');
    const element = String(link.sourceNodeName ?? 'Element');
    const to = link.destinationScreenName ? String(link.destinationScreenName) : 'unknown destination';
    const trigger = String((link.trigger as { type?: string } | undefined)?.type ?? 'ON_CLICK');
    return `- **${from}** · \`${element}\` (${trigger}) → **${to}**`;
  });

  if (exportTarget === 'react-native') {
    lines.push(
      '',
      'See `navigation-notes.md` for React Navigation route names and suggested `navigation.navigate(...)` handlers.',
    );
  }

  return lines.join('\n');
}

function formatPlatformSection(semantic: ExportContext['semantic']): string {
  const platform = semantic.platform;
  if (!platform) {
    return '';
  }

  const notes = (platform.implementationNotes as string[] | undefined) ?? [];
  if (notes.length === 0) {
    return '';
  }

  return `## Platform Notes (${String(platform.label ?? semantic.exportTarget)})

${notes.map((note) => `- ${note}`).join('\n')}
`;
}
