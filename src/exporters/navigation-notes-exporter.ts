import type { ExportContext } from './base';
import { BaseExporter } from './base';
import type { ExportTargetId } from '@/constants/export-targets';
import { EXPORT_FILE_NAMES } from '@/constants';

/**
 * Generates platform-specific navigation implementation notes.
 */
export class NavigationNotesExporter extends BaseExporter {
  readonly id = 'navigation-notes';
  readonly fileName = EXPORT_FILE_NAMES.NAVIGATION_NOTES;

  constructor(private readonly exportTargetId: ExportTargetId = 'react-native') {
    super();
  }

  export(context: ExportContext) {
    const content =
      this.exportTargetId === 'react-native'
        ? buildReactNativeNavigationNotes(context)
        : buildGenericNavigationNotes(context);

    return this.buildFile(content);
  }
}

function buildGenericNavigationNotes(context: ExportContext): string {
  const { semantic } = context;
  const links = semantic.navigation.links;

  return `# Navigation Notes

This export includes ${semantic.navigation.linkCount} prototype link(s) from Figma.

Use \`navigation.links\` in \`data.json\` to wire screen-to-screen flows in your target framework.

${links.length > 0 ? formatLinkSummary(links) : '_No prototype links were found on the exported screens._'}
`;
}

function buildReactNativeNavigationNotes(context: ExportContext): string {
  const { semantic } = context;
  const platform = semantic.platform ?? {};
  const routes = (platform.routes as Array<Record<string, unknown>> | undefined) ?? [];
  const linkMappings =
    (platform.linkMappings as Array<Record<string, unknown>> | undefined) ?? [];
  const initialRouteName = String(platform.initialRouteName ?? 'Screen');
  const drawerSlug = String(platform.drawerMenuSlug ?? 'menu-white');

  return `# React Navigation / Expo Router Notes

This export uses **real navigators** — not hand-rolled tab bars or menu screens pasted into every file.

Read \`platform/react-native/packages.json\` for install commands and \`platform/react-native/views.json\` for viewKind → library bindings.

## Recommended packages

- \`expo-router\` (recommended app shell)
- \`@react-navigation/native\`
- \`@react-navigation/native-stack\`
- \`@react-navigation/bottom-tabs\`
- \`@react-navigation/drawer\`
- \`react-native-screens\`
- \`react-native-safe-area-context\`
- \`react-native-gesture-handler\`
- \`react-native-reanimated\`

Install: see \`platform/react-native/packages.json\` → \`installHint\`

## Architecture (required)

Use **layered navigators** — do NOT implement navigation chrome separately in each screen:

\`\`\`text
Root (Expo Router or NavigationContainer)
├── DrawerNavigator          ← hamburger / side menu (${drawerSlug})
│   └── TabNavigator         ← bottom tabs when spec.flags.hasBottomTabBar
│       ├── Stack: main tabs (home, explore, …)
│       └── Modal stack      ← filter, share, …
└── Auth stack group         ← sign-in, sign-up, onboarding (no tabs)
\`\`\`

### Bottom tabs (\`viewKind: bottomTabBar\`)

When \`spec.json\` → \`navigation.bottomTabBar\` is true:

- Use \`@react-navigation/bottom-tabs\` or Expo Router \`(tabs)/\`
- Match tab **labels, order, icons, active state, and center FAB** from \`reference.png\`
- **Forbidden:** custom \`<BottomTabBar />\` copy-pasted into every screen

### Drawer / side menu (\`viewKind: drawerTrigger\`)

When \`spec.json\` lists \`navigation.drawerMenuSlug\`:

- Use \`@react-navigation/drawer\` with \`createDrawerNavigator\`
- Menu content screen: \`${drawerSlug}\` (or slug from spec)
- Hamburger buttons use \`navigation.openDrawer()\` — wire assets from \`assets.json\`

### Stack screens

All catalog slugs register as stack or tab screens. Modals use \`presentation: 'modal'\`.

## Screen routes

${routes.length > 0 ? routes.map(formatRouteLine).join('\n') : '_No screens exported._'}

Suggested \`initialRouteName\`: \`${initialRouteName}\`

## Expo Router layout example

\`\`\`text
app/
  _layout.tsx              # Root NavigationContainer / Drawer
  (auth)/
    sign-in.tsx
    sign-up.tsx
  (tabs)/
    _layout.tsx            # Tab navigator
    home.tsx
    map-view.tsx
  (drawer)/
    menu-white.tsx
  filter.tsx               # modal presentation
\`\`\`

## React Navigation example (stack + tabs + drawer)

\`\`\`tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

function MainTabs() {
  return (
    <Tabs.Navigator>
      {/* Register tab screens from catalog/screens.json — match reference.png */}
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Drawer.Navigator screenOptions={{ drawerType: 'front' }}>
        <Drawer.Screen name="Main" component={MainTabs} />
        <Drawer.Screen name="MenuWhite" component={MenuWhiteScreen} />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}
\`\`\`

## Prototype link mappings

${linkMappings.length > 0 ? linkMappings.map(formatLinkMapping).join('\n\n') : '_No screen-to-screen prototype links were found. Wire navigation from spec.json and UX flow._'}

## Per-screen workflow

1. Read \`screens/{slug}/spec.json\` → \`navigation.requiredNavigators\`
2. Read \`screens/{slug}/reference.png\` for tab bar / back button / drawer trigger
3. Thin route files re-export \`src/screens/{slug}/\` — no inline 200-line layouts

---

See also \`AGENTS.md\`, \`platform/react-native/views.json\`, and \`README.md\`.
`;
}

function formatRouteLine(route: Record<string, unknown>): string {
  const initial = route.isInitial ? ' _(initial)_' : '';
  return `- \`${String(route.routeName)}\` → \`src/screens/${String(route.slug ?? route.routeName).toLowerCase()}/\`${initial}`;
}

function formatLinkMapping(link: Record<string, unknown>): string {
  const fromRoute = String(link.fromRoute ?? 'Unknown');
  const sourceNodeName = String(link.sourceNodeName ?? 'Element');
  const toRoute = link.toRoute ? String(link.toRoute) : 'unknown destination';
  const trigger = String(link.trigger ?? 'ON_CLICK');
  const navigateCall = link.reactNavigation ? String(link.reactNavigation) : 'navigation.navigate(...)';

  return `- **${fromRoute}** · \`${sourceNodeName}\` (${trigger}) → **${toRoute}**
  - Suggested handler: \`${navigateCall}\``;
}

function formatLinkSummary(links: Record<string, unknown>[]): string {
  return links
    .map((link) => {
      const from = String(link.sourceScreenName ?? 'Unknown');
      const element = String(link.sourceNodeName ?? 'Element');
      const to = link.destinationScreenName ? String(link.destinationScreenName) : 'unknown';
      return `- ${from} · ${element} → ${to}`;
    })
    .join('\n');
}
