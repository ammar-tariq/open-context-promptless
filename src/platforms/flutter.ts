import type { PlatformAdapter } from './types';

/**
 * Placeholder adapter for a future Flutter export target.
 */
export const flutterPlatformAdapter: PlatformAdapter = {
  id: 'flutter',
  label: 'Flutter',
  status: 'coming-soon',

  enhanceSemantic(semantic) {
    return {
      ...semantic,
      platform: {
        id: 'flutter',
        label: 'Flutter',
        status: 'coming-soon',
        navigationLibrary: 'Navigator / GoRouter',
        implementationNotes: [
          'Flutter export target is planned.',
          'navigation.links will map to Navigator.pushNamed or GoRouter routes.',
        ],
      },
    };
  },
};

/**
 * Placeholder adapter for a future SwiftUI export target.
 */
export const swiftUiPlatformAdapter: PlatformAdapter = {
  id: 'swiftui',
  label: 'SwiftUI',
  status: 'coming-soon',

  enhanceSemantic(semantic) {
    return {
      ...semantic,
      platform: {
        id: 'swiftui',
        label: 'SwiftUI',
        status: 'coming-soon',
        navigationLibrary: 'NavigationStack',
        implementationNotes: [
          'SwiftUI export target is planned.',
          'navigation.links will map to NavigationLink destinations.',
        ],
      },
    };
  },
};
