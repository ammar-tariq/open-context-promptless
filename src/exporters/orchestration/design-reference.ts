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

export const FORBIDDEN_TEMPLATE_BATCHING = `
## Forbidden template batching (React Native + General)

- **Do NOT** create \`src/screens/_templates/\` views shared across multiple catalog slugs.
- **Do NOT** create \`screenDefinitions.json\` (or similar) mapping many slugs → one template + config.
- **Do NOT** run \`generate-screens.mjs\` / codegen that writes identical \`index.tsx\` stubs for every slug.
- **Do NOT** reuse one \`*ScreenView\` component with a \`step\` or \`variant\` prop across \`create-league\`, \`create-league-2\`, etc.

Each catalog slug is a **separate screen** with its own \`src/screens/{slug}/\` implementation.

Read \`screens/{slug}/spec.json\` for \`screenKind\` — suffixes like \`-2\` are **not** wizard step numbers.
Use \`screens/{slug}/copy.json\` for **verbatim** labels, placeholders, and button text.
`.trim();

export const FORBIDDEN_VISUAL_SHORTCUTS = `
## Forbidden visual shortcuts (all targets)

These patterns produce screens that **look wrong** even when copy strings match. Do **not** use them.

### Placeholders instead of design assets
- **Do NOT** use solid \`backgroundColor\` blocks when \`map.json\` lists an \`asset\` path for that node.
- **Do NOT** use solid \`View\` blobs for nodes with \`role: "decorative"\` or \`viewKind: "decorative"\` — use \`decorative.json\` PNGs at map opacity.
- **Do NOT** skip \`assets/images/*.png\` referenced in \`assets.json\` or the map.
- **Do NOT** use \`assets/icons/*.svg\` on React Native — use PNG paths from \`assets.json\`.
- **Do NOT** substitute generic icon libraries (e.g. Ionicons) when the design exports specific icons in \`assets/\`.

### Generic layout shells
- **Do NOT** apply a reusable "auth template" (purple gradient header + white card overlay) unless \`reference.png\` clearly shows that layout for **this slug**.
- **Do NOT** hand-roll bottom tab bars or drawer menus in every screen — use \`@react-navigation/bottom-tabs\` and \`@react-navigation/drawer\` per \`navigation-notes.md\`.
- **Do NOT** reuse one \`EventCard\`, \`AuthTextField\`, or \`BottomTabBar\` shape across screens if it does not match each slug's \`reference.png\`.
- **Do NOT** reorder major sections (headings, lists, banners) differently from \`map.json\` \`topPercent\` order — check \`spec.json\` → \`sectionOrder\` when present.

### Shared components vs per-screen fidelity
- Shared components in \`src/components/\` are for **repeated patterns that match the design** — not to stub every screen with the same layout.
- If a shared component does not match \`reference.png\` for a slug, **fix the component or write screen-local UI** — do not ship the shortcut.

### Completion gates
- **Do NOT** mark a screen done without opening \`screens/{slug}/reference.png\` side-by-side with the running UI.
- **Do NOT** mark phase 03 complete until phase 05 visual checks pass for every slug.
`.trim();

export const MANDATORY_SCREEN_WORKFLOW = `
## Mandatory per-screen workflow

For **every** slug in \`catalog/screens.json\`, follow this sequence — no skipping steps:

1. **Open** \`screens/{slug}/reference.png\` — study layout, colors, section order, icons, and images.
2. **Read** \`screens/{slug}/spec.json\` → \`implementationChecklist\`, \`forbiddenShortcuts\`, and \`navigation\`.
3. **Read** \`screens/{slug}/layer-order.json\` — flat paint order (decorative layers first).
4. **Read** \`screens/{slug}/decorative.json\` when present — gradient blobs, blur layers, decorative PNGs.
5. **Read** \`platform/react-native/views.json\` for each \`viewKind\` used on this screen (implementation spec — NOT a runtime renderer).
6. **Read** \`platform/react-native/fonts.json\` — load exact font families (do not substitute system fonts).
7. **Read** \`screens/{slug}/copy.json\` → \`bindings\` — each string has \`mapNodeId\` for placement.
8. **Read** \`implementation-stubs/{slug}.tsx\` — TODO checklist tied to map nodes (not runnable code).
9. **Read** \`screens/{slug}/map.json\` — note \`viewKind\`, \`role\`, \`asset\` paths, gradients, blur, and section order.
10. **Implement** \`src/screens/{slug}/index.tsx\` + \`styles.ts\` unique to this slug.
11. **Wire assets** from \`assets.json\` / map — no color placeholders for image or decorative nodes.
12. **Compare** running UI to \`reference.png\` — must pass \`spec.json\` → \`qa.maxPixelDiffPercent\` threshold.

If \`spec.json\` lists \`sectionOrder\`, render sections in that exact top-to-bottom order.
Check \`spec.json\` → \`requirements\` for linearGradient, blur, drawer, and bottomTabs flags.
Run \`node context/scripts/check-visual-shortcuts.mjs\` in CI before merging.
See \`examples/golden-sign-in/\` for a worked auth screen pattern.
Wire navigation from \`navigation/wiring.json\` — one row per prototype link.
`.trim();

export const ASSETS_AND_QA = `
## Assets (React Native — PNG only)

- **Use only** \`assets/images/*.png\` paths from \`screens/{slug}/assets.json\` and \`assets/manifest.json\`.
- PNGs are **cropped to Figma layer bounds** (2× scale) — use \`placementPixels\` width/height for display size, not the PNG file dimensions.
- Decorative blobs use \`*-decorative.png\` filenames — render at \`style.opacity\` from \`decorative.json\`.
- **Do NOT** use \`assets/icons/*.svg\` on React Native — SVG is not exported for the RN target.
- Copy or \`require()\` PNGs listed in \`assets/registry-scaffold.ts\` (scaffold for your app registry).
- For decorative blobs: use \`screens/{slug}/decorative.json\` — absolute \`Image\` at \`style.opacity\`, \`pointerEvents: 'none'\`.
- Preserve \`style.borderRadius\` and colors from the map when relevant.

## View dictionary (implementation spec — NOT a runtime renderer)

- Read \`platform/react-native/views.json\` for each \`viewKind\` in \`map.json\`.
- Look up the **library**, **component**, and **pattern** — then write real screen code.
- **Forbidden:** generic \`<MapRenderer node={view} />\` or config-wrapper stubs.

## QA

- Compare each finished screen to \`screens/{slug}/reference.png\` before marking it done.
- Follow \`phases/05-qa.md\` for the full checklist.
- Verify every string in \`screens/{slug}/copy.json\` appears verbatim in the implemented UI.
- Check \`export-warnings.json\` for missing or broken asset exports.
`.trim();
