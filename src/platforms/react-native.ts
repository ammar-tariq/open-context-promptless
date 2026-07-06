import type { ParsedDesign, PrototypeLink } from '@/types';
import type { SemanticDesign } from '@/types/semantic';
import { toRouteName } from '@/utils/route-names';
import { slugify } from '@/utils';
import { detectDrawerMenuSlug } from '@/map/view-kind';
import { NavigationNotesExporter } from '@/exporters/navigation-notes-exporter';
import type { PlatformAdapter } from './types';

export const reactNativePlatformAdapter: PlatformAdapter = {
  id: 'react-native',
  label: 'React Native',
  status: 'supported',

  enhanceSemantic(semantic: SemanticDesign, design: ParsedDesign): SemanticDesign {
    const slugs = design.screens.map((screen) => slugify(screen.name) || screen.id);
    const drawerMenuSlug = detectDrawerMenuSlug(slugs);

    const routes = semantic.screens.map((screen, index) => ({
      screenId: screen.id,
      screenName: screen.name,
      routeName: toRouteName(screen.name),
      slug: slugify(screen.name) || screen.id,
      componentName: `${toRouteName(screen.name)}Screen`,
      isInitial: index === 0,
    }));

    const routeByScreenId = new Map(routes.map((route) => [route.screenId, route]));
    const linkMappings = design.navigation.links
      .filter((link) => link.destinationScreenId)
      .map((link) => mapLinkToReactNavigation(link, routeByScreenId));

    return {
      ...semantic,
      platform: {
        id: 'react-native',
        label: 'React Native',
        status: 'supported',
        navigationLibrary: '@react-navigation/native',
        stackNavigatorPackage: '@react-navigation/native-stack',
        recommendedPackages: [
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
          'expo-router',
        ],
        routes,
        initialRouteName: routes[0]?.routeName ?? 'Screen',
        drawerMenuSlug,
        linkMappings,
        implementationNotes: buildReactNativeNotes(design, routes, linkMappings.length, drawerMenuSlug),
      },
    };
  },

  getAdditionalExporters() {
    return [new NavigationNotesExporter('react-native')];
  },
};

function mapLinkToReactNavigation(
  link: PrototypeLink,
  routeByScreenId: Map<
    string,
    {
      screenId: string;
      screenName: string;
      routeName: string;
      componentName: string;
      isInitial: boolean;
    }
  >,
): Record<string, unknown> {
  const fromRoute = routeByScreenId.get(link.sourceScreenId)?.routeName ?? toRouteName(link.sourceScreenName);
  const toRoute =
    link.destinationScreenId !== null
      ? (routeByScreenId.get(link.destinationScreenId)?.routeName ??
        toRouteName(link.destinationScreenName ?? ''))
      : null;

  const trigger = link.trigger.type;
  const handler = toRoute ? `navigation.navigate('${toRoute}')` : null;

  return {
    id: link.id,
    sourceNodeId: link.sourceNodeId,
    sourceNodeName: link.sourceNodeName,
    fromScreenId: link.sourceScreenId,
    fromScreenName: link.sourceScreenName,
    fromRoute,
    toScreenId: link.destinationScreenId,
    toScreenName: link.destinationScreenName,
    toRoute,
    trigger,
    navigationType: link.navigation,
    transition: link.transition,
    reactNavigation: handler,
    elementHint: `Attach to "${link.sourceNodeName}" on ${fromRoute}Screen using onPress.`,
  };
}

function buildReactNativeNotes(
  design: ParsedDesign,
  routes: Array<{ routeName: string; componentName: string }>,
  mappedLinkCount: number,
  drawerMenuSlug: string | null,
): string[] {
  const notes = [
    'Use Expo + TypeScript + Expo Router unless the repo already uses React Native CLI.',
    'Implement typed screen modules per AGENTS.md — do NOT build a generic map.json renderer.',
    'Each screen: src/screens/{slug}/index.tsx + styles.ts; thin re-export in src/app/{slug}.tsx.',
    'Read platform/react-native/views.json for viewKind → library bindings (NOT a runtime renderer).',
    'React Native export is PNG-only — use assets/images/*.png from assets.json; ignore assets/icons/*.svg.',
    'Use @react-navigation/bottom-tabs for tab bars and @react-navigation/drawer for side menus — not hand-rolled chrome.',
    'Decorative blobs: render as absolute expo-image Image at map opacity — see screens/{slug}/decorative.json.',
    `Register ${routes.length} screen route(s): ${routes.map((route) => route.routeName).join(', ') || 'none'}.`,
    `Suggested initial route: ${routes[0]?.routeName ?? 'Screen'}.`,
    drawerMenuSlug ? `Drawer menu slug detected: ${drawerMenuSlug}` : 'No drawer menu slug detected from screen names.',
    'Wire prototype links using navigation.navigate(...) on the exported source element.',
    'Load all fonts from shared/tokens.json — do not substitute system fonts.',
    'See navigation-notes.md and platform/react-native/packages.json.',
  ];

  if (design.navigation.linkCount === 0) {
    notes.push('No Figma prototype links were found; define routes manually from exported screens.');
  } else {
    notes.push(`${mappedLinkCount} link(s) mapped to React Navigation navigate calls.`);
  }

  return notes;
}
