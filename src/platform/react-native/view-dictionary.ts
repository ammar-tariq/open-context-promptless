import type { ViewKind } from '@/types/map';

export interface ViewDictionaryEntry {
  description: string;
  library: string;
  component: string;
  pattern: string;
  packages: string[];
  bindFromMap?: string[];
  props?: Record<string, string>;
  forbidden?: string[];
  fallback?: string;
  notes?: string;
}

export type ViewDictionary = Record<ViewKind, ViewDictionaryEntry>;

export const REACT_NATIVE_VIEW_DICTIONARY: ViewDictionary = {
  screen: {
    description: 'Screen root — implement unique code in src/screens/{slug}/',
    library: 'react-native',
    component: 'View',
    pattern: 'screen-root',
    packages: [],
    notes: 'NOT a generic map renderer — write index.tsx + styles.ts per slug',
  },
  container: {
    description: 'Layout container (View wrapper)',
    library: 'react-native',
    component: 'View',
    pattern: 'layout',
    packages: [],
    bindFromMap: ['placement', 'style.backgroundColor', 'style.borderRadius'],
  },
  text: {
    description: 'Text label or heading',
    library: 'react-native',
    component: 'Text',
    pattern: 'typography',
    packages: [],
    bindFromMap: ['text.content', 'text.fontSize', 'text.fontFamily', 'text.color'],
    forbidden: ['Inventing copy not in copy.json'],
  },
  textField: {
    description: 'Text input field',
    library: 'react-native',
    component: 'TextInput',
    pattern: 'form-control',
    packages: [],
    bindFromMap: ['copy.json placeholders', 'text.content'],
    notes: 'Use icons from assets.json when map lists asset on field',
  },
  primaryButton: {
    description: 'Primary CTA button',
    library: 'react-native',
    component: 'Pressable',
    pattern: 'form-action',
    packages: [],
    bindFromMap: ['copy.json actions'],
  },
  icon: {
    description: 'Small icon — PNG from assets/images/',
    library: 'expo-image',
    component: 'Image',
    pattern: 'asset-image',
    packages: ['expo-image'],
    bindFromMap: ['asset'],
    forbidden: ['@expo/vector-icons when map has asset path', 'assets/icons/*.svg on React Native'],
  },
  image: {
    description: 'Photo or illustration',
    library: 'expo-image',
    component: 'Image',
    pattern: 'asset-image',
    packages: ['expo-image'],
    bindFromMap: ['asset', 'placement'],
    forbidden: ['Solid backgroundColor placeholders when asset exists'],
  },
  decorative: {
    description: 'Non-interactive background blob — NOT a layout container',
    library: 'expo-image',
    component: 'Image',
    pattern: 'absolute-layer',
    packages: ['expo-image'],
    bindFromMap: ['asset', 'style.opacity', 'placement'],
    props: { pointerEvents: 'none', contentFit: 'contain' },
    forbidden: [
      'Solid View backgroundColor circles',
      'TouchableOpacity wrapper',
      'Opacity 1.0 when map says 0.4-0.7',
    ],
    fallback: 'linearGradient',
    notes: 'See screens/{slug}/decorative.json — render behind form content',
  },
  linearGradient: {
    description: 'Gradient fill from Figma',
    library: 'expo-linear-gradient',
    component: 'LinearGradient',
    pattern: 'absolute-layer',
    packages: ['expo-linear-gradient'],
    bindFromMap: ['style.gradient', 'style.opacity', 'placement'],
    props: { pointerEvents: 'none' },
    forbidden: ['Solid color when style.gradient is present'],
    fallback: 'decorative',
    notes: 'If gradient stops missing, use decorative PNG asset instead',
  },
  blurView: {
    description: 'Frosted glass / blur panel',
    library: 'expo-blur',
    component: 'BlurView',
    pattern: 'overlay',
    packages: ['expo-blur'],
    bindFromMap: ['style.blur.radius', 'style.opacity', 'placement'],
    forbidden: ['Semi-transparent View without blur'],
    notes: 'Compare to reference.png — Android may need tint adjustment',
  },
  bottomTabBar: {
    description: 'App-level bottom tab navigation',
    library: '@react-navigation/bottom-tabs',
    component: 'createBottomTabNavigator',
    pattern: 'navigator',
    packages: ['@react-navigation/bottom-tabs', '@react-navigation/native'],
    forbidden: [
      'Custom BottomTabBar pasted into every screen file',
      'Wrong tab order or labels vs reference.png',
    ],
    notes: 'Use Expo Router (tabs) or Tab.Navigator once at app root',
  },
  drawerTrigger: {
    description: 'Hamburger / menu button opening drawer',
    library: '@react-navigation/drawer',
    component: 'DrawerActions',
    pattern: 'navigation-action',
    packages: ['@react-navigation/drawer', 'react-native-gesture-handler', 'react-native-reanimated'],
    bindFromMap: ['asset'],
    notes: 'navigation.openDrawer() — menu screen uses DrawerNavigator',
  },
  navigation: {
    description: 'Navigation chrome element',
    library: '@react-navigation/native',
    component: 'Pressable',
    pattern: 'navigation-action',
    packages: ['@react-navigation/native'],
  },
  statusBar: {
    description: 'System status bar — do not duplicate',
    library: 'react-native',
    component: 'StatusBar',
    pattern: 'system-chrome',
    packages: [],
    forbidden: ['Re-implementing status bar when contentArea.top is set'],
  },
};

export const REACT_NATIVE_PACKAGES = {
  core: [
    '@react-navigation/native',
    '@react-navigation/native-stack',
    '@react-navigation/bottom-tabs',
    '@react-navigation/drawer',
    'react-native-screens',
    'react-native-safe-area-context',
    'react-native-gesture-handler',
    'react-native-reanimated',
    'expo-image',
    'expo-linear-gradient',
    'expo-blur',
    'expo-font',
    'expo-router',
  ] as string[],
  byViewKind: Object.fromEntries(
    Object.entries(REACT_NATIVE_VIEW_DICTIONARY).map(([kind, entry]) => [kind, entry.packages]),
  ) as Record<ViewKind, string[]>,
};

export function generateReactNativeViewsJson(): string {
  return JSON.stringify(
    {
      version: 1,
      target: 'react-native',
      readme:
        'Implementation dictionary — tells agents WHICH library/component pattern to use per viewKind. NOT a runtime renderer.',
      views: REACT_NATIVE_VIEW_DICTIONARY,
    },
    null,
    2,
  );
}

export function generateReactNativePackagesJson(): string {
  return JSON.stringify(
    {
      version: 1,
      target: 'react-native',
      recommended: REACT_NATIVE_PACKAGES.core,
      byViewKind: REACT_NATIVE_PACKAGES.byViewKind,
      installHint: 'Run: npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs @react-navigation/drawer react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-reanimated expo-image expo-linear-gradient expo-blur expo-router',
    },
    null,
    2,
  );
}

export function collectRequiredPackages(viewKinds: ViewKind[]): string[] {
  const packages = new Set<string>(['@react-navigation/native', 'react-native-screens', 'react-native-safe-area-context']);

  for (const kind of viewKinds) {
    for (const pkg of REACT_NATIVE_VIEW_DICTIONARY[kind]?.packages ?? []) {
      packages.add(pkg);
    }
  }

  return Array.from(packages).sort();
}
