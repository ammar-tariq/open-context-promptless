import type { ExportTargetId } from '@/constants/export-targets';
import { EXPORT_FILE_NAMES } from '@/constants';
import type { ExportContext } from './base';
import { BaseExporter } from './base';

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

  return `# React Navigation Notes

This export target is optimized for **React Native** apps using **React Navigation**.

## Recommended packages

- \`@react-navigation/native\`
- \`@react-navigation/native-stack\`
- \`react-native-screens\`
- \`react-native-safe-area-context\`

## Screen routes

Map each exported Figma screen to a stack screen:

${routes.length > 0 ? routes.map(formatRouteLine).join('\n') : '_No screens exported._'}

Suggested \`initialRouteName\`: \`${initialRouteName}\`

## Starter navigator

\`\`\`tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="${initialRouteName}">
${routes.map((route) => `        <Stack.Screen name="${String(route.routeName)}" component={${String(route.componentName)}} />`).join('\n')}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
\`\`\`

## Prototype link mappings

Wire Figma prototype interactions to React Navigation \`navigate\` calls:

${linkMappings.length > 0 ? linkMappings.map(formatLinkMapping).join('\n\n') : '_No screen-to-screen prototype links were found. Add navigation manually from exported screens._'}

## How to use this file

1. Create screen components that match the exported Figma screens.
2. Register them in a native stack navigator using the route names above.
3. Attach \`onPress\` handlers on the source elements listed below.
4. Reference \`data.json\` for layout, typography, colors, and assets while implementing each screen.

---

See also \`README.md\` and \`data.json\` (\`navigation\` + \`platform\` sections).
`;
}

function formatRouteLine(route: Record<string, unknown>): string {
  const initial = route.isInitial ? ' _(initial)_' : '';
  return `- \`${String(route.routeName)}\` → \`${String(route.componentName)}\`${initial}`;
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
