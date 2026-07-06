import type {
  CopyBinding,
  CopyBindingCategory,
  LayoutPattern,
  MapViewNode,
  ScreenCopyManifest,
  ScreenKind,
  ScreenMap,
  ScreenSpec,
} from '@/types/map';
import { collectViewKinds, walkMapViews } from '@/map/map-builder';
import { detectDrawerMenuSlug } from '@/map/view-kind';
import { normalizeScreenName } from '@/utils/screen-slug';

export interface VariantGroupInfo {
  normalizedName: string;
  canonicalSlug: string;
  memberSlugs: string[];
}

export interface BuildScreenSpecOptions {
  map: ScreenMap;
  slug: string;
  variantGroups: VariantGroupInfo[];
  allSlugs?: string[];
}

interface CollectedText {
  mapNodeId: string;
  figmaId: string;
  content: string;
  fontSize: number;
  fontFamily?: string;
  name: string;
  topPercent: number | null;
}

/** Groups exported screens by normalized Figma name for variant metadata. */
export function buildVariantGroups(
  screens: Array<{ name: string; slug: string }>,
): VariantGroupInfo[] {
  const grouped = new Map<string, string[]>();

  for (const screen of screens) {
    const key = normalizeScreenName(screen.name);
    const bucket = grouped.get(key) ?? [];
    bucket.push(screen.slug);
    grouped.set(key, bucket);
  }

  return Array.from(grouped.entries()).map(([normalizedName, memberSlugs]) => ({
    normalizedName,
    canonicalSlug: pickCanonicalSlug(memberSlugs),
    memberSlugs: [...memberSlugs].sort(),
  }));
}

function pickCanonicalSlug(slugs: string[]): string {
  const withoutNumericSuffix = slugs.find((slug) => !/-\d+$/.test(slug));
  if (withoutNumericSuffix) {
    return withoutNumericSuffix;
  }

  return [...slugs].sort((a, b) => a.length - b.length)[0] ?? slugs[0] ?? 'screen';
}

function walkViews(nodes: MapViewNode[], visit: (node: MapViewNode) => void): void {
  for (const node of nodes) {
    visit(node);
    walkViews(node.children ?? [], visit);
  }
}

function collectVisibleTexts(map: ScreenMap): CollectedText[] {
  const texts: CollectedText[] = [];

  walkViews(map.views, (node) => {
    if (!node.visible || node.role === 'statusBar' || !node.text?.content) {
      return;
    }

    const content = node.text.content.trim();
    if (content.length === 0) {
      return;
    }

    texts.push({
      mapNodeId: node.id,
      figmaId: node.figmaId,
      content,
      fontSize: node.text.fontSize,
      fontFamily: node.text.fontFamily,
      name: node.name,
      topPercent: node.placement.absolute.topPercent ?? null,
    });
  });

  return texts;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function categorizeCopy(texts: CollectedText[]): ScreenCopyManifest['copy'] {
  const labels: string[] = [];
  const placeholders: string[] = [];
  const actions: string[] = [];
  const headings: string[] = [];
  const body: string[] = [];

  for (const entry of texts) {
    const { content } = entry;

    if (/\*$/.test(content) && content.length < 40) {
      labels.push(content);
      continue;
    }

    if (/^Enter /i.test(content) || content === 'Upload Image') {
      placeholders.push(content);
      continue;
    }

    if (
      /@email|@gmail|password|confirm password|full name|search\.\.\./i.test(content) &&
      content.length < 40
    ) {
      placeholders.push(content);
      continue;
    }

    if (/^(Sign in|Sign up)$/i.test(content)) {
      headings.push(content);
      continue;
    }

    if (
      /^(Next Step|Create Now|Ok|Skip Now|Skip|Sign In|Continue|Subscribe|Pay Now|Back to|Create League|Send|Accept|Confirm|Get Started|Sign Up|Login)/i.test(
        content,
      ) &&
      content.length < 36
    ) {
      actions.push(content);
      continue;
    }

    if (/Step \d+\/\d+/i.test(content)) {
      headings.push(content);
      continue;
    }

    if (content.length > 48 || content.includes('🎉') || content.startsWith('"')) {
      body.push(content);
      continue;
    }

    if (entry.name === 'Heading' || entry.name === 'Description' || entry.fontSize >= 16) {
      headings.push(content);
      continue;
    }

    headings.push(content);
  }

  return {
    headings: uniqueStrings(headings),
    labels: uniqueStrings(labels),
    placeholders: uniqueStrings(placeholders),
    actions: uniqueStrings(actions),
    body: uniqueStrings(body),
  };
}

function classifyBindingCategory(content: string, entry: CollectedText, grouped: ScreenCopyManifest['copy']): CopyBindingCategory {
  if (grouped.headings.includes(content)) return 'heading';
  if (grouped.labels.includes(content)) return 'label';
  if (grouped.placeholders.includes(content)) return 'placeholder';
  if (grouped.actions.includes(content)) return 'action';
  if (grouped.body.includes(content)) return 'body';

  if (entry.fontSize >= 20) return 'heading';
  if (/^Enter /i.test(content)) return 'placeholder';
  if (entry.name.toLowerCase().includes('button')) return 'action';
  return 'body';
}

function buildCopyBindings(texts: CollectedText[], grouped: ScreenCopyManifest['copy']): CopyBinding[] {
  return texts.map((entry) => ({
    mapNodeId: entry.mapNodeId,
    figmaId: entry.figmaId,
    name: entry.name,
    content: entry.content,
    category: classifyBindingCategory(entry.content, entry, grouped),
    topPercent: entry.topPercent,
    fontSize: entry.fontSize,
    ...(entry.fontFamily ? { fontFamily: entry.fontFamily } : {}),
  }));
}

function buildQaThresholds(slug: string, screenKind: ScreenKind): ScreenSpec['qa'] {
  const maxPixelDiffPercent =
    screenKind === 'auth' || screenKind === 'splash' ? 3 : screenKind.startsWith('modal-') ? 4 : 5;

  return {
    maxPixelDiffPercent,
    compareTo: `screens/${slug}/reference.png`,
    notes: 'Run side-by-side visual comparison before marking screen done. Lower threshold = stricter QA.',
  };
}

function detectWhiteCard(map: ScreenMap): boolean {
  let found = false;

  walkViews(map.views, (node) => {
    if (found || !node.visible) {
      return;
    }

    const bg = node.style?.backgroundColor?.toLowerCase();
    const width = node.placement.absolute.widthPercent ?? 0;
    const height = node.placement.absolute.heightPercent ?? 0;
    const radius = node.style?.borderRadius ?? 0;

    if (
      (bg === '#ffffff' || bg === '#fff') &&
      width >= 75 &&
      height >= 60 &&
      radius >= 12
    ) {
      found = true;
    }
  });

  return found;
}

function detectBottomTabBar(texts: CollectedText[]): boolean {
  const lowered = texts.map((t) => t.content.toLowerCase());
  const joined = lowered.join(' ');

  if (
    joined.includes('home') &&
    joined.includes('discover') &&
    (joined.includes('community') || joined.includes('leagues'))
  ) {
    return true;
  }

  const navSets = [
    ['explore', 'events', 'map'],
    ['home', 'search', 'profile'],
    ['feed', 'discover', 'profile'],
  ];

  for (const set of navSets) {
    if (set.every((label) => joined.includes(label))) {
      return true;
    }
  }

  const bottomNavLabels = texts.filter(
    (t) =>
      t.topPercent !== null &&
      t.topPercent >= 88 &&
      t.content.length <= 20 &&
      /^[a-z\s]+$/i.test(t.content),
  );

  return bottomNavLabels.length >= 3;
}

function countImageAssets(map: ScreenMap): number {
  let count = 0;

  walkMapViews(map.views, (node) => {
    if (node.visible && node.asset?.includes('/images/') && node.asset.endsWith('.png')) {
      count += 1;
    }
  });

  return count;
}

function detectDecorativeFlags(map: ScreenMap): {
  hasDecorativeBackground: boolean;
  hasBlur: boolean;
  hasLinearGradient: boolean;
} {
  let hasDecorativeBackground = false;
  let hasBlur = false;
  let hasLinearGradient = false;

  walkMapViews(map.views, (node) => {
    if (node.role === 'decorative' || node.viewKind === 'decorative') {
      hasDecorativeBackground = true;
    }
    if (node.viewKind === 'blurView' || node.style?.blur) {
      hasBlur = true;
    }
    if (node.viewKind === 'linearGradient' || node.style?.gradient) {
      hasLinearGradient = true;
    }
  });

  return { hasDecorativeBackground, hasBlur, hasLinearGradient };
}

function detectBackButton(map: ScreenMap, slug: string): boolean {
  if (/sign-up|onboarding|reset|resset|verification/i.test(slug)) {
    return true;
  }

  let found = false;
  walkMapViews(map.views, (node) => {
    if (found) {
      return;
    }

    if (node.viewKind === 'drawerTrigger') {
      return;
    }

    const name = node.name.toLowerCase();
    if (name.includes('back') || name.includes('chevron') || name.includes('arrow-left')) {
      found = true;
    }
  });

  return found;
}

function detectScreenBackground(map: ScreenMap): string | undefined {
  for (const view of map.views) {
    if (view.style?.backgroundColor && view.placement.absolute.widthPercent && view.placement.absolute.widthPercent > 90) {
      return view.style.backgroundColor;
    }
  }

  return undefined;
}

function buildRequiredNavigators(
  flags: ScreenSpec['flags'],
  slug: string,
  drawerSlug: string | null,
): string[] {
  const navigators: string[] = ['native-stack'];

  if (flags.hasBottomTabBar) {
    navigators.push('bottom-tabs');
  }

  if (drawerSlug && (slug === drawerSlug || /home|menu/i.test(slug))) {
    navigators.push('drawer');
  }

  return navigators;
}

const SECTION_HEADING_PATTERN =
  /^(nearby you|upcoming events|see all|popular|featured|invite your friends|sign in|sign up|verification|reset password|resset password)/i;

function buildSectionOrder(texts: CollectedText[]): string[] {
  const sections = texts
    .filter(
      (t) =>
        t.topPercent !== null &&
        t.topPercent < 90 &&
        (SECTION_HEADING_PATTERN.test(t.content) ||
          (t.fontSize >= 16 && t.content.length <= 40 && !t.content.includes('•'))),
    )
    .sort((a, b) => (a.topPercent ?? 0) - (b.topPercent ?? 0));

  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const entry of sections) {
    const key = entry.content.toLowerCase();
    if (seen.has(key) || entry.content === 'See All') {
      continue;
    }

    seen.add(key);
    ordered.push(entry.content);
  }

  return ordered.slice(0, 6);
}

function classifyScreenKind(
  slug: string,
  copy: ScreenCopyManifest['copy'],
  allStrings: string[],
): ScreenKind {
  const joined = allStrings.join(' ').toLowerCase();

  if (/step\s*\d+\s*\/\s*\d+/i.test(joined)) {
    return 'form-wizard-step';
  }

  if (/successfully!?/i.test(joined) && /(created|updated|sent|accepted)/i.test(joined)) {
    return 'modal-success';
  }

  if (/limit reached|invalid code|didn't match|payment error|error popup/i.test(joined)) {
    return 'modal-error';
  }

  if (slug.includes('popup') || copy.body.some((t) => t.length > 60 && /modal|popup/i.test(t))) {
    return 'modal-overlay';
  }

  if (copy.labels.some((l) => /banner image/i.test(l)) || copy.placeholders.includes('Upload Image')) {
    return 'form';
  }

  if (/password|sign in|sign up|welcome to|credentials/i.test(joined)) {
    return 'auth';
  }

  if (slug === 'splash' || joined.includes('karaoke night') && copy.actions.length === 0) {
    if (slug === 'splash') return 'splash';
  }

  if (/leaderboard|participants|all participants|team/i.test(slug)) {
    return 'list';
  }

  if (/^home(-\d+)?$/.test(slug)) {
    return 'home';
  }

  if (/league-details|vote-now|create-event|create-league|subscription|invite/i.test(slug)) {
    return 'detail';
  }

  return 'screen';
}

function detectLayoutPattern(
  slug: string,
  _map: ScreenMap,
  screenKind: ScreenKind,
  hasWhiteCard: boolean,
): LayoutPattern {
  if (screenKind === 'modal-success' || screenKind === 'modal-error' || screenKind === 'modal-overlay') {
    return 'modal-overlay';
  }

  if (slug.includes('popup')) {
    return 'modal-overlay';
  }

  if (hasWhiteCard) {
    return 'white-card-on-navy';
  }

  if (screenKind === 'home' || screenKind === 'auth') {
    return 'full-bleed';
  }

  return 'standard';
}

function buildImplementationChecklist(
  spec: Pick<
    ScreenSpec,
    | 'slug'
    | 'screenKind'
    | 'layoutPattern'
    | 'copy'
    | 'flags'
    | 'variantOf'
    | 'variantNote'
    | 'sectionOrder'
    | 'navigation'
    | 'viewKindsUsed'
    | 'qa'
  >,
): string[] {
  const checklist: string[] = [
    `STOP — open screens/${spec.slug}/reference.png and keep it visible while coding`,
    `Read screens/${spec.slug}/spec.json → forbiddenShortcuts before writing any layout code`,
    `Read screens/${spec.slug}/layer-order.json — render decorative layers in paint order`,
    `Read screens/${spec.slug}/copy.json bindings — each string has mapNodeId for placement`,
    `Read platform/react-native/views.json — look up viewKind for each node in map.json`,
    `Read screens/${spec.slug}/assets.json and decorative.json — wire every PNG path listed`,
  ];

  if (spec.sectionOrder && spec.sectionOrder.length >= 2) {
    checklist.push(
      `Render sections top-to-bottom in this order: ${spec.sectionOrder.map((s) => `"${s}"`).join(' → ')}`,
    );
  }

  if (spec.flags.hasDecorativeBackground) {
    checklist.push(
      'Render decorative layers from decorative.json as absolute Images at map opacity — NOT solid colored Views',
    );
  }

  if (spec.flags.hasLinearGradient) {
    checklist.push('Use expo-linear-gradient when style.gradient is present — or decorative PNG fallback');
  }

  if (spec.flags.hasBlur) {
    checklist.push('Use expo-blur BlurView when style.blur is present — not a semi-transparent View');
  }

  if (spec.navigation.bottomTabBar) {
    checklist.push(
      'Use @react-navigation/bottom-tabs (or Expo Router tabs) — do NOT paste a custom tab bar into this screen file',
    );
  }

  if (spec.navigation.drawerMenuSlug) {
    checklist.push(
      `Side menu: use @react-navigation/drawer — menu screen slug is "${spec.navigation.drawerMenuSlug}"`,
    );
  }

  if (spec.navigation.hasBackButton) {
    checklist.push('Include back navigation control matching reference.png');
  }

  checklist.push(
    `Implement in src/screens/${spec.slug}/index.tsx + styles.ts (unique to this slug — no config wrapper)`,
  );

  if (spec.flags.hasImageAssets) {
    checklist.push(
      'Use Image components with paths from map.json asset fields — no solid-color placeholder blocks',
    );
  }

  if (spec.layoutPattern === 'white-card-on-navy') {
    checklist.push('White rounded card container on navy background (see map white rectangle)');
  }

  if (spec.screenKind === 'auth' && !spec.flags.hasWhiteCard) {
    checklist.push(
      'Do NOT use gradient header + white card overlay — match reference.png layout (often light background + centered logo)',
    );
  }

  if (spec.screenKind === 'home') {
    checklist.push(
      'Match header, category chips, scroll direction (horizontal vs vertical), and tab bar from reference.png',
    );
  }

  if (spec.flags.hasProgressStep) {
    checklist.push('Render step indicator and progress bar matching copy headings');
  }

  if (spec.flags.hasFileUpload) {
    checklist.push('Include dashed upload / Banner Image field');
  }

  if (spec.flags.hasBottomTabBar) {
    checklist.push(
      'Implement bottom tab bar matching reference.png — correct labels, order, active state, and center FAB if shown',
    );
  }

  for (const label of spec.copy.labels.slice(0, 6)) {
    checklist.push(`Field label must read exactly: "${label}"`);
  }

  for (const placeholder of spec.copy.placeholders.slice(0, 4)) {
    checklist.push(`Placeholder must read exactly: "${placeholder}"`);
  }

  for (const action of spec.copy.actions.slice(0, 3)) {
    checklist.push(`Primary action text must read exactly: "${action}"`);
  }

  if (spec.variantOf) {
    checklist.push(
      `This is a separate UI state (${spec.screenKind}) — not step ${spec.slug.split('-').pop()} of ${spec.variantOf}`,
    );
  }

  if (spec.variantNote) {
    checklist.push(spec.variantNote);
  }

  checklist.push(
    `Compare finished UI side-by-side with screens/${spec.slug}/reference.png — max ${spec.qa.maxPixelDiffPercent}% pixel diff`,
  );

  return checklist;
}

function buildVariantNote(
  slug: string,
  canonicalSlug: string,
  screenKind: ScreenKind,
  memberCount: number,
): string | undefined {
  if (slug === canonicalSlug || memberCount <= 1) {
    return undefined;
  }

  if (screenKind === 'modal-success') {
    return `Variant of "${canonicalSlug}" — success modal overlay. Do NOT implement as the next form step.`;
  }

  if (screenKind === 'modal-error') {
    return `Variant of "${canonicalSlug}" — error/limit modal. Do NOT implement as the next form step.`;
  }

  return `Variant of "${canonicalSlug}" — different Figma frame (${screenKind}). Slug suffix is NOT a wizard step number.`;
}

/**
 * Builds spec.json + copy.json content from a screen map.
 */
export function buildScreenSpec(options: BuildScreenSpecOptions): {
  spec: ScreenSpec;
  copy: ScreenCopyManifest;
} {
  const { map, slug, variantGroups, allSlugs = [] } = options;
  const texts = collectVisibleTexts(map);
  const copyGrouped = categorizeCopy(texts);
  const allStrings = uniqueStrings(texts.map((t) => t.content));

  const group = variantGroups.find((g) => g.memberSlugs.includes(slug));
  const canonicalSlug = group?.canonicalSlug ?? slug;
  const variantOf = slug !== canonicalSlug ? canonicalSlug : null;

  const hasProgressStep = allStrings.some((s) => /Step \d+\/\d+/i.test(s));
  const hasFileUpload =
    copyGrouped.labels.some((l) => /banner|upload/i.test(l)) ||
    copyGrouped.placeholders.some((p) => /upload/i.test(p));
  const hasWhiteCard = detectWhiteCard(map);
  const hasBottomTabBar = detectBottomTabBar(texts);
  const hasImageAssets = countImageAssets(map) > 0;
  const sectionOrder = buildSectionOrder(texts);
  const decorativeFlags = detectDecorativeFlags(map);
  const viewKindsUsed = collectViewKinds(map);
  const drawerMenuSlug = detectDrawerMenuSlug(allSlugs);
  const hasBackButton = detectBackButton(map, slug);
  const backgroundColor = detectScreenBackground(map);

  const screenKind = classifyScreenKind(slug, copyGrouped, allStrings);
  const layoutPattern = detectLayoutPattern(slug, map, screenKind, hasWhiteCard);
  const variantNote = variantOf
    ? buildVariantNote(slug, canonicalSlug, screenKind, group?.memberSlugs.length ?? 1)
    : undefined;

  const flags = {
    hasProgressStep,
    hasFileUpload,
    hasBottomTabBar,
    hasWhiteCard,
    hasImageAssets,
    hasDecorativeBackground: decorativeFlags.hasDecorativeBackground,
    hasBlur: decorativeFlags.hasBlur,
    hasLinearGradient: decorativeFlags.hasLinearGradient,
  };

  const navigation = {
    bottomTabBar: hasBottomTabBar,
    drawerMenuSlug,
    hasBackButton,
    requiredNavigators: buildRequiredNavigators(flags, slug, drawerMenuSlug),
  };

  const requirements = {
    linearGradient: decorativeFlags.hasLinearGradient,
    blur: decorativeFlags.hasBlur,
    drawer: Boolean(drawerMenuSlug) && (slug === drawerMenuSlug || /home|menu/i.test(slug)),
    bottomTabs: hasBottomTabBar,
  };

  const qa = buildQaThresholds(slug, screenKind);

  const specBase = {
    slug,
    name: map.screen.name,
    figmaId: map.screen.figmaId,
    route: map.screen.route,
    screenKind,
    layoutPattern,
    variantOf,
    variantNote,
    backgroundColor,
    navigation,
    sectionOrder: sectionOrder.length >= 2 ? sectionOrder : undefined,
    flags,
    copy: copyGrouped,
    requirements,
    qa,
    viewKindsUsed,
  };

  const spec: ScreenSpec = {
    ...specBase,
    implementationChecklist: [],
    forbiddenShortcuts: buildForbiddenShortcuts(slug, variantOf, screenKind, specBase.flags, decorativeFlags),
  };

  spec.implementationChecklist = buildImplementationChecklist(spec);

  const copy: ScreenCopyManifest = {
    slug,
    name: map.screen.name,
    strings: allStrings,
    copy: copyGrouped,
    bindings: buildCopyBindings(texts, copyGrouped),
  };

  return { spec, copy };
}

function buildForbiddenShortcuts(
  slug: string,
  variantOf: string | null,
  screenKind: ScreenKind,
  flags: ScreenSpec['flags'],
  decorativeFlags: ReturnType<typeof detectDecorativeFlags>,
): string[] {
  const shortcuts = [
    'Do not route this slug through a shared FormScreenView / HomeScreenView / ListScreenView template',
    'Do not add this slug to screenDefinitions.json or generate-screens.mjs batch config',
    'Do not use a one-line wrapper component with a config object for this slug',
    'Do not mark this screen complete without comparing to reference.png',
  ];

  if (flags.hasImageAssets) {
    shortcuts.push('Do not use backgroundColor placeholders where map.json lists asset paths');
  }

  if (screenKind === 'auth' && !flags.hasWhiteCard) {
    shortcuts.push('Do not apply generic gradient-header + white-card auth shell — match reference.png');
  }

  if (screenKind === 'home') {
    shortcuts.push('Do not reorder content sections differently from spec.json sectionOrder');
  }

  if (decorativeFlags.hasDecorativeBackground) {
    shortcuts.push('Do not use solid opaque View circles for decorative blobs — use decorative.json PNG assets at map opacity');
  }

  if (flags.hasBottomTabBar) {
    shortcuts.push('Do not implement a one-off custom tab bar in this screen — use bottom-tabs navigator');
  }

  if (variantOf) {
    shortcuts.push(`Do not merge with ${variantOf} as a step prop — screenKind is "${screenKind}"`);
  }

  if (screenKind === 'form-wizard-step') {
    shortcuts.push('Do not invent field labels — use copy.json labels exactly');
  }

  if (slug.includes('popup') || screenKind.startsWith('modal-')) {
    shortcuts.push('Implement as modal/overlay presentation — see reference.png');
  }

  return shortcuts;
}

export function buildScreenSpecSummaryLine(spec: ScreenSpec): string {
  const variant = spec.variantOf ? ` · variant of \`${spec.variantOf}\`` : '';
  return `- [ ] **${spec.name}** (\`${spec.slug}\`) — ${spec.screenKind} · ${spec.layoutPattern}${variant}`;
}

export function buildScreenSpecDetailSection(spec: ScreenSpec): string {
  const lines = [
    `### ${spec.name} (\`${spec.slug}\`)`,
    '',
    `- **Kind:** ${spec.screenKind}`,
    `- **Layout:** ${spec.layoutPattern}`,
    spec.variantOf ? `- **Variant of:** \`${spec.variantOf}\` — ${spec.variantNote ?? 'not a sequential step'}` : '',
    spec.sectionOrder?.length
      ? `- **Section order:** ${spec.sectionOrder.map((s) => `"${s}"`).join(' → ')}`
      : '',
    `- **Spec:** \`screens/${spec.slug}/spec.json\` · **Copy:** \`screens/${spec.slug}/copy.json\` · **Ref:** \`screens/${spec.slug}/reference.png\``,
    '',
    '**Checklist:**',
    ...spec.implementationChecklist.map((item) => `- [ ] ${item}`),
    '',
    '**Forbidden shortcuts:**',
    ...spec.forbiddenShortcuts.map((item) => `- ⛔ ${item}`),
    '',
  ].filter(Boolean);

  return lines.join('\n');
}
