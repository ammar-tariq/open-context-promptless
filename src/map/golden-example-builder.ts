import type { ScreenCopyManifest, ScreenMap, ScreenSpec } from '@/types/map';

/**
 * Worked example for auth-style screens — agents should match this pattern.
 */
export function buildGoldenSignInExample(
  sourceSlug: string,
  map: ScreenMap,
  spec: ScreenSpec,
  copy: ScreenCopyManifest,
): Record<string, string> {
  const heading = copy.copy.headings[0] ?? copy.bindings.find((b) => b.category === 'heading')?.content ?? 'Sign in';
  const emailPlaceholder =
    copy.copy.placeholders.find((p) => /email/i.test(p)) ??
    copy.bindings.find((b) => b.category === 'placeholder' && /email/i.test(b.content))?.content ??
    'Enter your email';
  const passwordPlaceholder =
    copy.copy.placeholders.find((p) => /password/i.test(p)) ??
    'Enter your password';
  const signInAction =
    copy.copy.actions.find((a) => /sign in/i.test(a)) ??
    copy.copy.actions[0] ??
    'Sign In';

  const hasDecorative = spec.flags.hasDecorativeBackground;
  const decorativeNote = hasDecorative
    ? `      {/* Decorative blobs — see screens/${sourceSlug}/decorative.json */}
      {/* <DesignImage source={designAssets['assets/images/...']} style={styles.blob} /> */}`
    : '';

  const indexTsx = `/**
 * GOLDEN EXAMPLE — auth screen pattern
 *
 * Source slug: ${sourceSlug}
 * Copy this structure into src/screens/{your-slug}/ — adapt asset paths and copy bindings.
 *
 * Read screens/${sourceSlug}/copy.json bindings for exact strings.
 */

import { Pressable, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './styles';

// Wire from assets/registry-scaffold.ts or your design asset registry
// const logo = require('../../context/assets/images/logo.png');

export default function GoldenSignInScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
${decorativeNote}
      <View style={styles.content}>
        {/* <Image source={logo} style={styles.logo} contentFit="contain" /> */}
        <Text style={styles.heading}>${heading.replace(/"/g, '\\"')}</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="${emailPlaceholder.replace(/"/g, '\\"')}"
          placeholderTextColor="#9CA3AF"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="${passwordPlaceholder.replace(/"/g, '\\"')}"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
        />

        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>${signInAction.replace(/"/g, '\\"')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
`;

  const bg = spec.backgroundColor ?? map.views[0]?.style?.backgroundColor ?? '#FFFFFF';

  const stylesTs = `import { StyleSheet } from 'react-native';

/** Golden example styles — match reference.png for ${sourceSlug} */
export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '${bg}',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  logo: {
    width: 120,
    height: 40,
    alignSelf: 'center',
    marginBottom: 32,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
`;

  const readme = `# Golden Example — Sign In Pattern

This folder shows a **complete** auth screen implementation pattern derived from \`${sourceSlug}\`.

## When to use

- Implementing any \`screenKind: "auth"\` slug
- Unsure how to wire decorative layers, copy bindings, and form fields together

## Files

- \`index.tsx\` — composition (adapt asset paths from \`screens/${sourceSlug}/assets.json\`)
- \`styles.ts\` — StyleSheet matching layout intent

## Rules

1. Copy **structure**, not blindly paste — each slug's \`reference.png\` is authoritative
2. Use **verbatim** strings from \`copy.json\` bindings (\`mapNodeId\`)
3. Render decorative layers from \`decorative.json\` **behind** form content
4. Do NOT import this folder at runtime — copy into \`src/screens/{slug}/\`

Source: OpenContext golden example from \`${sourceSlug}\` (${map.screen.name}).
`;

  return {
    'examples/golden-sign-in/README.md': readme,
    'examples/golden-sign-in/index.tsx': indexTsx,
    'examples/golden-sign-in/styles.ts': stylesTs,
    'examples/golden-sign-in/source-slug.txt': sourceSlug,
  };
}

export function pickGoldenExampleSource(specs: ScreenSpec[]): ScreenSpec | null {
  const auth = specs.find((spec) => spec.screenKind === 'auth');
  if (auth) {
    return auth;
  }

  const signIn = specs.find((spec) => /sign-in|login|welcome/i.test(spec.slug));
  return signIn ?? specs[0] ?? null;
}
