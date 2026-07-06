import type { ExportTargetId } from '@/constants/export-targets';
import { getExportTargetDefinition } from '@/constants/export-targets';
import { CONTEXT_FOLDER_NAME } from '@/constants';
import type { VariantExportMode } from '@/types/map';

export interface StarterPromptInput {
  projectName: string;
  exportTarget: ExportTargetId;
  screenCount: number;
  uniqueScreenNames?: number;
  variantMode?: VariantExportMode;
  skippedVariantCount?: number;
}

function buildVariantGuidance(input: StarterPromptInput): string {
  const lines: string[] = [];

  if (input.variantMode === 'all' && input.uniqueScreenNames && input.uniqueScreenNames < input.screenCount) {
    lines.push(
      `**Variant warning:** ${input.screenCount} slugs map to ~${input.uniqueScreenNames} unique screen names.`,
      `- Read \`screens/{slug}/spec.json\` → \`screenKind\` for EVERY slug.`,
      `- \`create-league-2\` is NOT "step 2" — it may be a success modal (\`modal-success\`).`,
      `- See \`catalog/variant-groups.json\` for name groupings.`,
    );
  } else if (input.skippedVariantCount && input.skippedVariantCount > 0) {
    lines.push(
      `**Variants:** ${input.skippedVariantCount} duplicate frames skipped (see \`catalog/variants.json\`).`,
      `- Implement only the canonical slugs in \`catalog/screens.json\`.`,
    );
  } else {
    lines.push(
      `- Check \`screens/{slug}/spec.json\` if multiple slugs share a similar name.`,
    );
  }

  return lines.join('\n');
}

function generateReactNativeStarterPrompt(input: StarterPromptInput): string {
  const target = getExportTargetDefinition('react-native');
  const contextPath = `./${CONTEXT_FOLDER_NAME}`;
  const variantGuidance = buildVariantGuidance(input);

  return `I exported Figma design context for **${input.projectName}** into \`${contextPath}/\` in this repository.

**Target stack (confirmed):** React Native — Expo + TypeScript + Expo Router

**Before you implement any screens:**
1. Scaffold an **Expo + TypeScript** app with **Expo Router** if one does not exist yet.
2. Install React Navigation dependencies from \`${contextPath}/navigation-notes.md\`.
3. Confirm the OpenContext export is at \`${contextPath}/\` (\`BUILD.md\`, \`catalog/screens.json\`, \`screens/\`).

**Then build the full app autonomously — do not ask me screen-by-screen:**

**Forbidden:**
- Generic \`map.json\` renderers or layout engines
- \`src/screens/_templates/\` shared across multiple slugs
- \`screenDefinitions.json\` + \`generate-screens.mjs\` codegen stubs
- \`<FormScreenView step={n} />\` or similar config wrappers
- Solid-color placeholder blocks where \`map.json\` lists \`asset\` paths
- Generic auth gradient+card shell when \`reference.png\` shows a different layout
- Reordering sections differently from \`spec.json\` → \`sectionOrder\`
- Marking any screen done without side-by-side \`reference.png\` comparison

${variantGuidance}

1. Read \`${contextPath}/AGENTS.md\` first — especially **Forbidden visual shortcuts** and **Mandatory per-screen workflow**.
2. Read \`${contextPath}/BUILD.md\` and run every phase in \`${contextPath}/phases/\` (00 → 05).
3. Implement **all ${input.screenCount} screens** from \`${contextPath}/catalog/screens.json\`.
4. **Per slug (required order):** open \`reference.png\` → read \`spec.json\` → \`forbiddenShortcuts\` → \`copy.json\` → \`map.json\`.
5. Create **unique** \`src/screens/{slug}/index.tsx\` + \`styles.ts\` for each slug.
6. Wire \`assets/\` from map.json — no color placeholders for image nodes.
7. Use \`copy.json\` labels, placeholders, and button text **verbatim**.
8. Match \`spec.json\` → \`sectionOrder\` when present.
9. Extract shared UI into \`src/components/\` in phase 02 — but fix or override if a shared component diverges from \`reference.png\`.
10. Load fonts from \`${contextPath}/shared/tokens.json\`.
11. Do not add extra SafeArea \`paddingTop\` when \`contentArea.top\` is defined.
12. Compare each screen side-by-side with \`reference.png\` before moving to the next slug.

Export target: **${target.label}**
Work through the entire BUILD.md checklist without stopping for per-screen approval.`;
}

function generateGenericStarterPrompt(input: StarterPromptInput): string {
  const target = getExportTargetDefinition(input.exportTarget);
  const contextPath = `./${CONTEXT_FOLDER_NAME}`;
  const variantGuidance = buildVariantGuidance(input);

  return `I exported Figma design context for **${input.projectName}** into \`${contextPath}/\` in this repository.

**Target stack:** [FILL IN — e.g. React (Next.js), React Native (Expo), Flutter, SwiftUI]
*(If left blank, inspect this repo for an existing stack; if unclear, ask me **one question** about which stack to use, then proceed.)*

**Before you implement any screens:**
1. Confirm the target stack (see above or ask once).
2. Scaffold the application in this repository if one does not exist yet.
3. Confirm the OpenContext export is at \`${contextPath}/\`.

**Then build the full app autonomously — do not ask me screen-by-screen:**

**Forbidden:** Generic \`map.json\` runtime renderers, \`_templates/\` batching, codegen stub scripts, color placeholders for map assets, generic layout shells that diverge from \`reference.png\`, marking screens done without visual comparison.

${variantGuidance}

1. Read \`${contextPath}/AGENTS.md\` — **Forbidden visual shortcuts** and **Mandatory per-screen workflow**.
2. Run every phase in \`${contextPath}/phases/\` in order (00 → 05).
3. Implement **all ${input.screenCount} screens** from \`${contextPath}/catalog/screens.json\`.
4. **Per slug:** open \`reference.png\` first → \`spec.json\` → \`forbiddenShortcuts\` → \`copy.json\` → \`map.json\`.
5. Wire \`assets/\` from map — no color placeholders.
6. Match \`spec.json\` → \`sectionOrder\` when present.
7. Compare side-by-side with \`reference.png\` before moving to the next slug.

Export target: **${target.label}**
Work through the entire BUILD.md checklist without stopping for per-screen approval.`;
}

/**
 * Ready-to-paste kickoff prompt for AI coding agents.
 */
export function generateStarterPrompt(input: StarterPromptInput): string {
  if (input.exportTarget === 'react-native') {
    return generateReactNativeStarterPrompt(input);
  }
  return generateGenericStarterPrompt(input);
}

export function generatePromptMd(input: StarterPromptInput): string {
  const prompt = generateStarterPrompt(input);
  const isRn = input.exportTarget === 'react-native';

  const stackNote = isRn
    ? 'This export targets **React Native (Expo + TypeScript)**. Each screen includes `spec.json` and `copy.json`.'
    : 'Fill in **Target stack** in the prompt below if you already know it. Each screen includes `spec.json` and `copy.json`.';

  const variantNote =
    input.variantMode === 'all' && input.uniqueScreenNames && input.uniqueScreenNames < input.screenCount
      ? `\n\n> **Note:** This export includes **${input.screenCount} variant slugs** (${input.uniqueScreenNames} unique names). Read \`spec.json\` → \`screenKind\` for each — suffixes are not wizard steps.`
      : input.skippedVariantCount
        ? `\n\n> **Note:** ${input.skippedVariantCount} duplicate variants were skipped. See \`catalog/variants.json\`.`
        : '';

  return `# Agent Kickoff Prompt

Copy the block below into Cursor, Claude Code, Codex, or your AI coding agent **after** placing this folder at \`./context\` in your project repository.

## Prerequisites

1. Create or open your application repository.
2. Copy this entire \`context/\` folder to \`./context\` at the repository root.
3. ${stackNote}
4. Paste the prompt below into your agent.${variantNote}

---

## Prompt (copy from here)

${prompt}

---

## What happens next

The agent should read \`spec.json\` + \`copy.json\` per slug, follow \`forbiddenShortcuts\`, implement **unique** screens (no template batching), wire \`assets/\` from the map, and compare each \`reference.png\` side-by-side before moving on.

Generated by OpenContext.
`;
}
