import type { ParsedNavigation } from './navigation';
import type { SemanticNodeType } from './semantic';

export interface Dimensions {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ColorValue {
  r: number;
  g: number;
  b: number;
  a: number;
  hex: string;
}

export interface ColorToken {
  id: string;
  name: string;
  value: ColorValue;
  opacity?: number;
}

export interface TypographyStyle {
  fontFamily: string;
  fontStyle: string;
  fontWeight: number;
  fontSize: number;
  lineHeight: number | 'AUTO';
  letterSpacing: number;
  textAlignHorizontal: string;
  textAlignVertical: string;
  textDecoration: string;
  textCase: string;
  mixed?: boolean;
  segments?: TextStyleSegment[];
}

export interface TextStyleSegment {
  start: number;
  end: number;
  characters: string;
  fontFamily: string;
  fontStyle: string;
  fontWeight: number;
  fontSize: number;
  lineHeight: number | 'AUTO';
  letterSpacing: number;
  textDecoration: string;
  textCase: string;
  color?: ColorValue;
}

export interface SpacingValue {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface AutoLayoutInfo {
  mode: 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'GRID';
  primaryAxisAlignItems: string;
  counterAxisAlignItems: string;
  primaryAxisSizingMode: string;
  counterAxisSizingMode: string;
  itemSpacing: number;
  padding: SpacingValue;
  layoutWrap: string;
}

export interface ConstraintInfo {
  horizontal: string;
  vertical: string;
}

export interface BorderInfo {
  color?: ColorValue;
  weight: number;
  align: string;
  dashPattern: number[];
}

export interface EffectInfo {
  type: string;
  visible: boolean;
  radius?: number;
  color?: ColorValue;
  offset?: { x: number; y: number };
  spread?: number;
}

export interface CornerRadiusInfo {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
  uniform: boolean;
}

export interface VariableBinding {
  id: string;
  name: string;
  collectionName?: string;
  resolvedType?: string;
}

export interface AssetReference {
  id: string;
  name: string;
  hash?: string;
  format?: string;
  role?: 'image' | 'icon-vector' | 'icon-raster';
  exportPath?: string;
  rasterExportPath?: string;
  mimeType?: string;
  rasterMimeType?: string;
  width?: number;
  height?: number;
  cropped?: boolean;
  bounds?: Bounds;
  scaleMode?: string;
  imageTransform?: number[][];
}

export interface ComponentVariantProperty {
  name: string;
  value: string;
}

export interface ParsedNodeMetadata {
  figmaId: string;
  figmaType: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: string;
}

export interface ParsedNode {
  metadata: ParsedNodeMetadata;
  semanticType: SemanticNodeType;
  bounds: Bounds;
  layout?: AutoLayoutInfo;
  constraints?: ConstraintInfo;
  typography?: TypographyStyle;
  fills?: ColorValue[];
  strokes?: BorderInfo[];
  effects?: EffectInfo[];
  cornerRadius?: CornerRadiusInfo;
  spacing?: SpacingValue;
  textContent?: string;
  componentId?: string;
  componentName?: string;
  isInstance?: boolean;
  variantProperties?: ComponentVariantProperty[];
  variables?: VariableBinding[];
  assets?: AssetReference[];
  children: ParsedNode[];
}

export interface ParsedScreen {
  id: string;
  name: string;
  bounds: Bounds;
  root: ParsedNode;
}

export interface ParsedDesign {
  projectName: string;
  exportedAt: string;
  pluginVersion: string;
  screens: ParsedScreen[];
  components: ComponentSummary[];
  colors: ColorToken[];
  typography: TypographyStyle[];
  images: AssetReference[];
  icons: AssetReference[];
  navigation: ParsedNavigation;
  metadata: DesignMetadata;
}

export interface ComponentSummary {
  id: string;
  name: string;
  description?: string;
  variantCount: number;
  propertyNames: string[];
}

export interface DesignMetadata {
  screenCount: number;
  componentCount: number;
  imageCount: number;
  textElementCount: number;
  nodeCount: number;
  figmaFileName: string;
  figmaPageName: string;
}

export interface ContextPackageFile {
  path: string;
  content: string;
  encoding?: 'utf8' | 'base64';
}

export interface ContextPackage {
  folderName: string;
  files: ContextPackageFile[];
}

export interface ExportSummary {
  screenCount: number;
  componentCount: number;
  imageCount: number;
  iconCount: number;
  exportedAssetCount: number;
  deduplicatedAssetCount: number;
  skippedAssetCount: number;
  navigationLinkCount: number;
  textElementCount: number;
  mapFileCount: number;
  referenceImageCount: number;
  skippedVariantCount: number;
}

export * from './navigation';
export * from './semantic';
export * from './messages';
export * from './map';
