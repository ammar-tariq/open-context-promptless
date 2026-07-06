import { CONTEXT_FOLDER_NAME } from '@/constants';

/** Shared rules: map.json is a design spec, not a runtime layout engine. */
export const FORBIDDEN_GENERIC_RENDERER = `
## Forbidden patterns (all targets)

- **Do NOT** build a generic \`map.json\` interpreter, layout engine, or runtime renderer.
- **Do NOT** generate scripts that stub every screen with the same one-line JSON wrapper.
- **Do NOT** treat \`screens/{slug}/map.json\` as something the app reads at runtime.

\`map.json\` and \`reference.png\` are **design references while you implement** — read them, then write idiomatic UI code for the target stack.
`.trim();

export const DESIGN_REFERENCE_LAYOUT = `
## Design reference (from \`map.json\`)

When implementing layout manually:

1. Open \`screens/{slug}/map.json\` alongside \`screens/{slug}/reference.png\`.
2. Percentages are relative to the screen **content area** (below the status bar).
3. Ignore nodes with \`role: "statusBar"\` — do not duplicate system chrome.
4. Only implement nodes where \`visible: true\` unless documenting a variant state.
5. Text nodes use \`sizing: "intrinsic"\` — use \`text.fontSize\` in **pixels**, not percent.
6. Use \`placement.preferred\` (then \`absolute\`, \`insets\`, or \`center\`) to infer spacing while coding.
7. Allow **negative \`topPercent\`** on hero images — do not clip bleed assets unless the reference shows clipping.
8. **Do not add extra SafeArea padding** when the map already defines \`contentArea.top\`.
9. Use \`placementPixels\` only for QA on the design frame (${CONTEXT_FOLDER_NAME}/screen.frame), not as the primary layout API.
`.trim();

export const ASSETS_AND_QA = `
## Assets

- Copy or reference files from \`assets/\` into the application project.
- Preserve \`style.borderRadius\` and \`style.backgroundColor\` from the map when relevant.

## QA

- Compare each finished screen to \`screens/{slug}/reference.png\` before marking it done.
- Follow \`phases/05-qa.md\` for the full checklist.
`.trim();
