import type { ParsedDesign, PrototypeLink } from '@/types';
import type { SemanticDesign } from '@/types/semantic';
import { toRouteName } from '@/utils/route-names';
import { NavigationNotesExporter } from '@/exporters/navigation-notes-exporter';
import type { PlatformAdapter } from './types';

export const reactNativePlatformAdapter: PlatformAdapter = {
  id: 'react-native',
  label: 'React Native',
  status: 'supported',

  enhanceSemantic(semantic: SemanticDesign, design: ParsedDesign): SemanticDesign {
    const routes = semantic.screens.map((screen, index) => ({
      screenId: screen.id,
      screenName: screen.name,
      routeName: toRouteName(screen.name),
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
          'react-native-screens',
          'react-native-safe-area-context',
        ],
        routes,
        initialRouteName: routes[0]?.routeName ?? 'Screen',
        linkMappings,
        implementationNotes: buildReactNativeNotes(design, routes, linkMappings.length),
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
): string[] {
  const notes = [
    'Use @react-navigation/native with a native stack navigator for screen-to-screen flows.',
    `Register ${routes.length} screen route(s): ${routes.map((route) => route.routeName).join(', ') || 'none'}.`,
    `Suggested initial route: ${routes[0]?.routeName ?? 'Screen'}.`,
    'Wire prototype links using navigation.navigate(...) on the exported source element.',
    'See navigation-notes.md for a starter NavigationContainer setup.',
  ];

  if (design.navigation.linkCount === 0) {
    notes.push('No Figma prototype links were found; define routes manually from exported screens.');
  } else {
    notes.push(`${mappedLinkCount} link(s) mapped to React Navigation navigate calls.`);
  }

  return notes;
}
