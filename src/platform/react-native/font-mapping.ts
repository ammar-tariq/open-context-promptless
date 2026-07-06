import type { TypographyStyle } from '@/types';

export interface ReactNativeFontEntry {
  figmaFamily: string;
  fontFamily: string;
  loadMethod: 'expo-google-fonts' | 'expo-font-asset' | 'system-fallback';
  expoPackage?: string;
  importName?: string;
  fontFile?: string;
  notes?: string;
}

/** Known Figma → Expo font mappings. Unknown families get a scaffold entry. */
const KNOWN_FONT_MAPPINGS: Record<string, Omit<ReactNativeFontEntry, 'figmaFamily'>> = {
  Poppins: {
    fontFamily: 'Poppins_400Regular',
    loadMethod: 'expo-google-fonts',
    expoPackage: '@expo-google-fonts/poppins',
    importName: 'Poppins_400Regular',
    notes: 'Also load Poppins_600SemiBold, Poppins_700Bold for weights used in tokens.',
  },
  Hellix: {
    fontFamily: 'Hellix-Regular',
    loadMethod: 'expo-font-asset',
    fontFile: 'assets/fonts/Hellix-Regular.ttf',
    notes: 'Hellix is not on Google Fonts — add .ttf files to assets/fonts/ and load with useFonts.',
  },
  'Airbnb Cereal App': {
    fontFamily: 'Cereal',
    loadMethod: 'expo-font-asset',
    fontFile: 'assets/fonts/AirbnbCereal-Book.ttf',
    notes: 'Licensed font — obtain Airbnb Cereal files or substitute Inter via expo-font.',
  },
  Inter: {
    fontFamily: 'Inter_400Regular',
    loadMethod: 'expo-google-fonts',
    expoPackage: '@expo-google-fonts/inter',
    importName: 'Inter_400Regular',
  },
  Roboto: {
    fontFamily: 'Roboto_400Regular',
    loadMethod: 'expo-google-fonts',
    expoPackage: '@expo-google-fonts/roboto',
    importName: 'Roboto_400Regular',
  },
  'SF Pro Display': {
    fontFamily: 'System',
    loadMethod: 'system-fallback',
    notes: 'Use Platform.select — iOS system font. Do not substitute on Android without loading Inter.',
  },
  'SF Pro Text': {
    fontFamily: 'System',
    loadMethod: 'system-fallback',
    notes: 'Use Platform.select — iOS system font.',
  },
};

function normalizeFamilyName(family: string): string {
  return family.trim();
}

function scaffoldUnknownFont(family: string): ReactNativeFontEntry {
  const slug = family.replace(/\s+/g, '');
  return {
    figmaFamily: family,
    fontFamily: family,
    loadMethod: 'expo-font-asset',
    fontFile: `assets/fonts/${slug}-Regular.ttf`,
    notes: `No built-in mapping — add ${family} .ttf to assets/fonts/ and load with expo-font. Do NOT use system font.`,
  };
}

export function buildReactNativeFontMapping(typography: TypographyStyle[]): ReactNativeFontEntry[] {
  const families = new Set<string>();

  for (const style of typography) {
    if (style.fontFamily && style.fontFamily !== 'Mixed') {
      families.add(normalizeFamilyName(style.fontFamily));
    }

    for (const segment of style.segments ?? []) {
      if (segment.fontFamily && segment.fontFamily !== 'Mixed') {
        families.add(normalizeFamilyName(segment.fontFamily));
      }
    }
  }

  return Array.from(families)
    .sort()
    .map((family) => {
      const known = KNOWN_FONT_MAPPINGS[family];
      if (known) {
        return { figmaFamily: family, ...known };
      }
      return scaffoldUnknownFont(family);
    });
}

export function generateReactNativeFontsJson(typography: TypographyStyle[]): string {
  const fonts = buildReactNativeFontMapping(typography);
  const packages = Array.from(
    new Set(fonts.map((entry) => entry.expoPackage).filter(Boolean)),
  ) as string[];

  return JSON.stringify(
    {
      version: 1,
      target: 'react-native',
      readme:
        'Map Figma font families to expo-font / @expo-google-fonts. Do NOT substitute system fonts when a mapping exists.',
      fonts,
      googleFontPackages: packages,
      loadExample: `import { useFonts } from 'expo-font';
// See each entry's expoPackage / fontFile — load ALL weights used in shared/tokens.json`,
    },
    null,
    2,
  );
}
