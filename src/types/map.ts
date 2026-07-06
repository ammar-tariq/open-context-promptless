import type { Bounds, ConstraintInfo } from '@/types';

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
}

export interface MapViewNode {
  id: string;
  figmaId: string;
  type: string;
  name: string;
  zIndex: number;
  visible: boolean;
  role?: 'statusBar' | 'content';
  sizing?: 'intrinsic' | 'fixed';
  placement: ViewPlacement;
  placementPixels: PlacementPixels;
  style?: MapViewStyle;
  text?: MapTextStyle;
  asset?: string;
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

export interface ScreenCatalogEntry {
  id: string;
  slug: string;
  name: string;
  figmaId: string;
  route: string;
  paths: {
    map: string;
    reference: string;
    meta: string;
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
