import type { Bounds, ConstraintInfo } from '@/types';
import type { BlurEffect, GradientFill } from '@/types/fills';

export interface ContentArea {
  top: number;
  width: number;
  height: number;
}

export interface PlacementAbsolute {
  leftPercent: number;
  topPercent: number;
  widthPercent?: number;
  heightPercent?: number;
}

export interface PlacementInsets {
  topPercent: number;
  leftPercent: number;
  rightPercent: number | null;
  bottomPercent: number | null;
}

export interface PlacementCenter {
  centerXPercent: number | null;
  centerYPercent: number | null;
  widthPercent?: number;
  heightPercent?: number;
}

export type PlacementPreferred = 'absolute' | 'insets' | 'center';

export interface ViewPlacement {
  absolute: PlacementAbsolute;
  insets: PlacementInsets;
  center: PlacementCenter;
  constraints?: ConstraintInfo;
  preferred: PlacementPreferred;
}

export interface PlacementPixels {
  left: number;
  top: number;
  width?: number;
  height?: number;
}

export interface MapTextStyle {
  content: string;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: string;
  color?: string;
  textAlign?: string;
  maxWidthPercent?: number;
}

export interface MapViewStyle {
  backgroundColor?: string;
  borderRadius?: number;
  opacity?: number;
  gradient?: GradientFill;
  blur?: BlurEffect;
}

/** Maps to platform/react-native/views.json — not a runtime renderer. */
export type ViewKind =
  | 'screen'
  | 'container'
  | 'text'
  | 'textField'
  | 'primaryButton'
  | 'icon'
  | 'image'
  | 'decorative'
  | 'linearGradient'
  | 'blurView'
  | 'bottomTabBar'
  | 'drawerTrigger'
  | 'navigation'
  | 'statusBar';

export type MapNodeRole = 'statusBar' | 'content' | 'decorative' | 'navigation';

export interface MapViewNode {
  id: string;
  figmaId: string;
  type: string;
  name: string;
  viewKind: ViewKind;
  zIndex: number;
  visible: boolean;
  role: MapNodeRole;
  sizing?: 'intrinsic' | 'fixed';
  placement: ViewPlacement;
  placementPixels: PlacementPixels;
  style?: MapViewStyle;
  text?: MapTextStyle;
  /** PNG path under assets/images/ — primary for React Native exports */
  asset?: string;
  implementation?: {
    dictionaryRef: string;
    pointerEvents?: 'none' | 'auto';
    notes?: string;
  };
  source?: { autoLayout?: boolean };
  children: MapViewNode[];
}

export interface ScreenMap {
  screen: {
    id: string;
    slug: string;
    name: string;
    figmaId: string;
    frame: { width: number; height: number };
    contentArea: ContentArea;
    route: string;
  };
  reference: string;
  views: MapViewNode[];
}

export type ScreenKind =
  | 'form-wizard-step'
  | 'form'
  | 'modal-success'
  | 'modal-error'
  | 'modal-overlay'
  | 'auth'
  | 'splash'
  | 'home'
  | 'list'
  | 'detail'
  | 'screen';

export type LayoutPattern =
  | 'white-card-on-navy'
  | 'modal-overlay'
  | 'full-bleed'
  | 'standard';

export interface ScreenCopyFields {
  headings: string[];
  labels: string[];
  placeholders: string[];
  actions: string[];
  body: string[];
}

export type CopyBindingCategory = 'heading' | 'label' | 'placeholder' | 'action' | 'body';

export interface CopyBinding {
  mapNodeId: string;
  figmaId: string;
  name: string;
  content: string;
  category: CopyBindingCategory;
  topPercent: number | null;
  fontSize: number;
  fontFamily?: string;
}

export interface ScreenRequirements {
  linearGradient: boolean;
  blur: boolean;
  drawer: boolean;
  bottomTabs: boolean;
}

export interface ScreenQaThresholds {
  /** Max allowed pixel diff % vs reference.png before screen fails QA */
  maxPixelDiffPercent: number;
  compareTo: string;
  notes?: string;
}

export interface LayerOrderEntry {
  id: string;
  figmaId: string;
  name: string;
  viewKind: ViewKind;
  role: MapNodeRole;
  zIndex: number;
  topPercent: number | null;
  asset?: string;
  opacity?: number;
  visible: boolean;
}

export interface ScreenLayerOrderManifest {
  slug: string;
  readme: string;
  layers: LayerOrderEntry[];
}

export interface ScreenNavigationHints {
  bottomTabBar: boolean;
  drawerMenuSlug: string | null;
  hasBackButton: boolean;
  requiredNavigators: string[];
}

export interface ScreenSpec {
  slug: string;
  name: string;
  figmaId: string;
  route: string;
  screenKind: ScreenKind;
  layoutPattern: LayoutPattern;
  variantOf: string | null;
  variantNote?: string;
  backgroundColor?: string;
  navigation: ScreenNavigationHints;
  flags: {
    hasProgressStep: boolean;
    hasFileUpload: boolean;
    hasBottomTabBar: boolean;
    hasWhiteCard: boolean;
    hasImageAssets: boolean;
    hasDecorativeBackground: boolean;
    hasBlur: boolean;
    hasLinearGradient: boolean;
  };
  sectionOrder?: string[];
  copy: ScreenCopyFields;
  requirements: ScreenRequirements;
  qa: ScreenQaThresholds;
  viewKindsUsed: ViewKind[];
  implementationChecklist: string[];
  forbiddenShortcuts: string[];
}

export interface DecorativeLayerEntry {
  figmaId: string;
  name: string;
  viewKind: 'decorative' | 'linearGradient' | 'blurView';
  asset?: string;
  opacity?: number;
  placement: ViewPlacement;
  placementPixels: PlacementPixels;
  gradient?: GradientFill;
  blur?: BlurEffect;
  renderHint: string;
}

export interface ScreenDecorativeManifest {
  slug: string;
  layers: DecorativeLayerEntry[];
}

export interface ScreenAssetsManifest {
  slug: string;
  /** All PNG paths referenced on this screen */
  assets: string[];
  decorative: string[];
  icons: string[];
  photos: string[];
}

export interface AssetManifestEntry {
  path: string;
  type: 'png';
  width?: number;
  height?: number;
  usedBySlugs: string[];
  category: 'photo' | 'icon' | 'decorative' | 'other';
}

export interface AssetManifest {
  format: 'png-only';
  exportTarget: string;
  totalCount: number;
  assets: AssetManifestEntry[];
}

export interface ExportWarning {
  code: string;
  message: string;
  slug?: string;
  figmaId?: string;
  assetPath?: string;
}

export interface ExportWarningsManifest {
  warnings: ExportWarning[];
}

export interface ScreenCopyManifest {
  slug: string;
  name: string;
  strings: string[];
  copy: ScreenCopyFields;
  /** Maps each user-visible string to its map.json node — use for placement */
  bindings: CopyBinding[];
}

export interface ScreenCatalogEntry {
  id: string;
  slug: string;
  name: string;
  figmaId: string;
  route: string;
  screenKind?: ScreenKind;
  layoutPattern?: LayoutPattern;
  variantOf?: string | null;
  paths: {
    map: string;
    reference: string;
    meta: string;
    spec: string;
    copy: string;
    assets: string;
    decorative: string;
    layerOrder: string;
    stub: string;
  };
  frame: { width: number; height: number };
}

export interface VariantGroupEntry {
  canonical: string;
  canonicalSlug: string;
  skipped: Array<{ id: string; slug: string; name: string }>;
}

export type VariantExportMode = 'canonical' | 'all' | 'custom';

export interface ExportOptions {
  variantMode: VariantExportMode;
  canonicalOverrides?: Record<string, string>;
}

export interface ScreenFrameContext {
  screenBounds: Bounds;
  contentArea: ContentArea;
}

export interface BuildMapOptions {
  slug: string;
  contentArea: ContentArea;
  figmaNode?: SceneNode;
  zIndexStart?: number;
  rasterOnly?: boolean;
  allSlugs?: string[];
}
