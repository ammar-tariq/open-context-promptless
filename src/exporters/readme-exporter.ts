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
- \`catalog/variants.json\` — Skipped duplicate variants (when using canonical export mode).
- \`catalog/variant-groups.json\` — Name groups when multiple slugs share a Figma screen name.
- \`screens/{slug}/spec.json\` — Screen kind, layout pattern, navigation hints, implementation checklist.
- \`screens/{slug}/copy.json\` — Verbatim strings + \`bindings\` (each string mapped to \`mapNodeId\`).
- \`screens/{slug}/layer-order.json\` — Flat back-to-front paint order for decorative + content layers.
- \`screens/{slug}/assets.json\` — Per-screen PNG asset shortlist (React Native: PNG only).
- \`screens/{slug}/decorative.json\` — Decorative blobs, gradients, blur layers (when present).
- \`implementation-stubs/{slug}.tsx\` — TODO checklist tied to map nodes (not runnable — guides implementation).
- \`screens/{slug}/map.json\` — Design reference map with \`viewKind\`, \`role\`, assets (read while implementing — not runtime).
- \`screens/{slug}/reference.png\` — Full-frame reference image for visual QA.
- \`screens/{slug}/meta.json\` — Screen metadata (frame size, content area, route).
- \`shared/tokens.json\` — Colors, typography, spacing tokens.
- \`shared/components.json\` — Component summaries.
- \`navigation/flows.json\` — Prototype navigation links.
- \`navigation/wiring.json\` — Flat wiring table: fromSlug → toSlug with handler strings.
- \`data.json\` — Full semantic design tree (debug / legacy compatibility).
- \`assets/manifest.json\` — Catalog of exported PNG assets and which screens use them.
- \`assets/registry-scaffold.ts\` — Starter \`require()\` registry for app integration.
- \`assets/images/\` — Cropped raster exports (images + icon PNGs).
${semantic.exportTarget === 'react-native' ? '- `assets/icons/` — _Not used on React Native_ (SVG skipped; use PNG paths from `assets.json`).\n- `platform/react-native/views.json` — viewKind → library/component bindings (implementation spec, NOT a runtime renderer).\n- `platform/react-native/packages.json` — Required npm packages and install command.\n- `platform/react-native/fonts.json` — Figma font → expo-font / Google Fonts mapping.\n- `examples/golden-sign-in/` — Worked auth screen example (copy pattern, do not import at runtime).\n- `scripts/check-visual-shortcuts.mjs` — CI script to reject generic templates and missing assets.\n- `export-warnings.json` — Missing or failed asset exports to fix before QA.\n- `navigation-notes.md` — React Navigation / Expo Router architecture with route names and navigate() mappings.' : '- `assets/icons/` — Exported SVG vector icons from the design.'}

${formatPlatformSection(semantic)}

## Usage

1. Create or open your application repository and scaffold the project if needed.
2. Place this \`context/\` folder at \`./context\` in that repository.
3. Select the matching export target in OpenContext when exporting (**React Native** for Expo/RN-specific \`AGENTS.md\` and prompts).
4. Open \`PROMPT.md\`, copy the kickoff prompt, and paste it into Cursor, Claude Code, or your AI agent.
5. The agent should read \`BUILD.md\` and \`AGENTS.md\`, then run all phases without per-screen prompts.
6. For each screen: read \`spec.json\` (requirements + qa thresholds), \`layer-order.json\`, \`assets.json\`, \`decorative.json\`, \`copy.json\` bindings, \`implementation-stubs/{slug}.tsx\`, then match \`reference.png\`.
7. Compare implemented screens to \`screens/{slug}/reference.png\` — must pass \`spec.json\` → \`qa.maxPixelDiffPercent\`.
8. Reference PNG paths in \`assets.json\` / \`assets/manifest.json\` when implementing images and icons.
9. Wire navigation from \`navigation/wiring.json\`.
${semantic.exportTarget === 'react-native' ? '10. Run `node context/scripts/check-visual-shortcuts.mjs` in CI. Follow `AGENTS.md` — unique `src/screens/{slug}/` per catalog entry.' : '10. For General exports, confirm the target stack in `PROMPT.md` or let the agent ask once before implementing.'}

## Notes

- This package describes design intent; it does not contain generated application code.
- Screen names included in this export: ${screenNames || 'N/A'}.
- Prototype links from Figma are exported in \`data.json\` under \`navigation.links\`.
- Text nodes include resolved font families, styles, weights, and per-segment typography in \`data.json\`.
- Exported assets are cropped to their Figma layer bounds. React Native exports are **PNG-only** (\`assets/images/\`); SVG icons are skipped for the RN target.
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
