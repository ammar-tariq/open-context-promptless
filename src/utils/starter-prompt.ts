import type { ExportTargetId } from '@/constants/export-targets';
import { getExportTargetDefinition } from '@/constants/export-targets';
import { CONTEXT_FOLDER_NAME } from '@/constants';

export interface StarterPromptInput {
  projectName: string;
  exportTarget: ExportTargetId;
  screenCount: number;
}

function generateReactNativeStarterPrompt(input: StarterPromptInput): string {
  const target = getExportTargetDefinition('react-native');
  const contextPath = `./${CONTEXT_FOLDER_NAME}`;

  return `I exported Figma design context for **${input.projectName}** into \`${contextPath}/\` in this repository.

**Target stack (confirmed):** React Native — Expo + TypeScript + Expo Router

**Before you implement any screens:**
1. Scaffold an **Expo + TypeScript** app with **Expo Router** if one does not exist yet.
2. Install React Navigation dependencies from \`${contextPath}/navigation-notes.md\`.
3. Confirm the OpenContext export is at \`${contextPath}/\` (\`BUILD.md\`, \`catalog/screens.json\`, \`screens/\`).

**Then build the full app autonomously — do not ask me screen-by-screen:**

**Forbidden:** Do NOT build a generic \`map.json\` renderer, layout engine, or codegen scripts that stub every screen with \`<MapScreen map={...} />\`. Implement **real typed React Native screens**.

1. Read \`${contextPath}/AGENTS.md\` first — folder structure, naming, and forbidden patterns.
2. Read \`${contextPath}/BUILD.md\` and run every phase in \`${contextPath}/phases/\` (00 → 05).
3. Implement **all ${input.screenCount} screens** from \`${contextPath}/catalog/screens.json\`.
4. For each screen, create \`src/screens/{slug}/index.tsx\`, \`styles.ts\`, and optional \`components/\` — see \`AGENTS.md\`.
5. Use \`${contextPath}/screens/{slug}/map.json\` and \`reference.png\` as **design reference while coding** — not as a runtime layout format.
6. Extract shared UI (tab bar, buttons, headers) into \`src/components/\` in phase 02 — reuse them on every screen.
7. Load fonts from \`${contextPath}/shared/tokens.json\`. Do not substitute system fonts.
8. Do not add extra SafeArea \`paddingTop\` when the map already defines \`contentArea.top\`.
9. Copy assets from \`${contextPath}/assets/\` into the project.
10. Match each screen to \`reference.png\` before marking it done.

Export target: **${target.label}**
Work through the entire BUILD.md checklist without stopping for per-screen approval.`;
}

function generateGenericStarterPrompt(input: StarterPromptInput): string {
  const target = getExportTargetDefinition(input.exportTarget);
  const contextPath = `./${CONTEXT_FOLDER_NAME}`;

  return `I exported Figma design context for **${input.projectName}** into \`${contextPath}/\` in this repository.

**Target stack:** [FILL IN — e.g. React (Next.js), React Native (Expo), Flutter, SwiftUI]
*(If left blank, inspect this repo for an existing stack; if unclear, ask me **one question** about which stack to use, then proceed.)*

**Before you implement any screens:**
1. Confirm the target stack (see above or ask once).
2. Scaffold the application in this repository if one does not exist yet.
3. Confirm the OpenContext export is at \`${contextPath}/\` (\`BUILD.md\`, \`catalog/screens.json\`, \`screens/\`).

**Then build the full app autonomously — do not ask me screen-by-screen:**

**Forbidden:** Do NOT build a generic \`map.json\` runtime renderer or codegen scripts that stub every screen. Implement **proper UI code** for the confirmed stack.

1. Read \`${contextPath}/AGENTS.md\` and \`${contextPath}/BUILD.md\`.
2. Run every phase in \`${contextPath}/phases/\` in order (00 → 05).
3. Implement **all ${input.screenCount} screens** from \`${contextPath}/catalog/screens.json\`.
4. Use \`${contextPath}/screens/{slug}/map.json\` and \`reference.png\` as **design reference while coding** — not as a runtime layout format.
5. Apply idiomatic patterns for the confirmed stack (components, styles, folder structure).
6. Copy assets from \`${contextPath}/assets/\` into the project.
7. Match each screen to \`reference.png\` before marking it done.

Export target: **${target.label}**
Work through the entire BUILD.md checklist without stopping for per-screen approval.`;
}

/**
 * Ready-to-paste kickoff prompt for AI coding agents.
 * Assumes the exported package lives at ./context in the target repo.
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
    ? 'This export targets **React Native (Expo + TypeScript)**. The prompt below includes stack-specific structure and rules.'
    : 'Fill in **Target stack** in the prompt below if you already know it (e.g. `React Native (Expo)`, `Next.js`). Otherwise the agent will inspect the repo or ask you once.';

  return `# Agent Kickoff Prompt

Copy the block below into Cursor, Claude Code, Codex, or your AI coding agent **after** placing this folder at \`./context\` in your project repository.

## Prerequisites

1. Create or open your application repository.
2. Copy this entire \`context/\` folder to \`./context\` at the repository root.
3. ${stackNote}
4. Paste the prompt below into your agent.

---

## Prompt (copy from here)

${prompt}

---

## What happens next

The agent should confirm the stack (General export only), scaffold if needed, then follow \`BUILD.md\` through all phases — implementing **real screens**, not a JSON layout engine.

Generated by OpenContext.
`;
}
