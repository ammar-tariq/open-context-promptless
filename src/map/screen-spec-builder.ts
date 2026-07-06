import type {
  LayoutPattern,
  MapViewNode,
  ScreenCopyManifest,
  ScreenKind,
  ScreenMap,
  ScreenSpec,
} from '@/types/map';
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
}

interface CollectedText {
  content: string;
  fontSize: number;
  name: string;
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
      content,
      fontSize: node.text.fontSize,
      name: node.name,
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
  const joined = texts.map((t) => t.content.toLowerCase()).join(' ');
  return (
    joined.includes('home') &&
    joined.includes('discover') &&
    (joined.includes('community') || joined.includes('leagues'))
  );
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
    'slug' | 'screenKind' | 'layoutPattern' | 'copy' | 'flags' | 'variantOf' | 'variantNote'
  >,
): string[] {
  const checklist: string[] = [
    `Open screens/${spec.slug}/reference.png before writing code`,
    `Read screens/${spec.slug}/spec.json and use copy verbatim from screens/${spec.slug}/copy.json`,
    `Implement in src/screens/${spec.slug}/index.tsx + styles.ts (unique to this slug)`,
  ];

  if (spec.layoutPattern === 'white-card-on-navy') {
    checklist.push('White rounded card container on navy background (see map white rectangle)');
  }

  if (spec.flags.hasProgressStep) {
    checklist.push('Render step indicator and progress bar matching copy headings');
  }

  if (spec.flags.hasFileUpload) {
    checklist.push('Include dashed upload / Banner Image field');
  }

  if (spec.flags.hasBottomTabBar) {
    checklist.push('Use shared BottomTabBar — do not inline a new tab bar');
  }

  for (const label of spec.copy.labels.slice(0, 6)) {
    checklist.push(`Field label must read exactly: "${label}"`);
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

  checklist.push(`Compare finished UI to screens/${spec.slug}/reference.png`);

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
  const { map, slug, variantGroups } = options;
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

  const screenKind = classifyScreenKind(slug, copyGrouped, allStrings);
  const layoutPattern = detectLayoutPattern(slug, map, screenKind, hasWhiteCard);
  const variantNote = variantOf
    ? buildVariantNote(slug, canonicalSlug, screenKind, group?.memberSlugs.length ?? 1)
    : undefined;

  const specBase = {
    slug,
    name: map.screen.name,
    figmaId: map.screen.figmaId,
    route: map.screen.route,
    screenKind,
    layoutPattern,
    variantOf,
    variantNote,
    flags: {
      hasProgressStep,
      hasFileUpload,
      hasBottomTabBar,
      hasWhiteCard,
    },
    copy: copyGrouped,
  };

  const spec: ScreenSpec = {
    ...specBase,
    implementationChecklist: [],
    forbiddenShortcuts: buildForbiddenShortcuts(slug, variantOf, screenKind),
  };

  spec.implementationChecklist = buildImplementationChecklist(spec);

  const copy: ScreenCopyManifest = {
    slug,
    name: map.screen.name,
    strings: allStrings,
    copy: copyGrouped,
  };

  return { spec, copy };
}

function buildForbiddenShortcuts(
  slug: string,
  variantOf: string | null,
  screenKind: ScreenKind,
): string[] {
  const shortcuts = [
    'Do not route this slug through a shared FormScreenView / HomeScreenView / ListScreenView template',
    'Do not add this slug to screenDefinitions.json or generate-screens.mjs batch config',
    'Do not use a one-line wrapper component with a config object for this slug',
  ];

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
    `- **Spec:** \`screens/${spec.slug}/spec.json\` · **Copy:** \`screens/${spec.slug}/copy.json\` · **Ref:** \`screens/${spec.slug}/reference.png\``,
    '',
    '**Checklist:**',
    ...spec.implementationChecklist.map((item) => `- [ ] ${item}`),
    '',
  ].filter(Boolean);

  return lines.join('\n');
}
