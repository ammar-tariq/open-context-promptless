export type SemanticNodeType =
  | 'Screen'
  | 'Container'
  | 'Section'
  | 'Group'
  | 'Button'
  | 'Text'
  | 'Input'
  | 'Avatar'
  | 'Icon'
  | 'Image'
  | 'Card'
  | 'Navigation'
  | 'Divider'
  | 'List'
  | 'Grid'
  | 'Component'
  | 'Frame'
  | 'Unknown';

export interface SemanticNode {
  id: string;
  type: SemanticNodeType;
  name: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  layout?: Record<string, unknown>;
  constraints?: Record<string, unknown>;
  typography?: Record<string, unknown>;
  colors?: Record<string, unknown>;
  spacing?: Record<string, unknown>;
  effects?: Record<string, unknown>[];
  borders?: Record<string, unknown>[];
  cornerRadius?: Record<string, unknown>;
  variables?: Record<string, unknown>[];
  text?: string | SemanticTextContent;
  component?: {
    id: string;
    name: string;
    isInstance: boolean;
    variants?: Record<string, string>;
  };
  assets?: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
  children: SemanticNode[];
}

export interface SemanticTextContent {
  content: string;
  typography?: Record<string, unknown>;
  segments?: Record<string, unknown>[];
}

export interface SemanticDesign {
  exportTarget: string;
  project: {
    name: string;
    exportedAt: string;
    pluginVersion: string;
  };
  metadata: Record<string, unknown>;
  screens: SemanticNode[];
  navigation: {
    links: Record<string, unknown>[];
    linkCount: number;
  };
  platform?: Record<string, unknown>;
  components: Record<string, unknown>[];
  tokens: {
    colors: Record<string, unknown>[];
    typography: Record<string, unknown>[];
    fonts: Record<string, unknown>[];
    spacing: Record<string, unknown>[];
  };
  assets: {
    images: Record<string, unknown>[];
    icons: Record<string, unknown>[];
  };
  summary: {
    screenCount: number;
    componentCount: number;
    imageCount: number;
    iconCount: number;
    exportedAssetCount: number;
    textElementCount: number;
    nodeCount: number;
    navigationLinkCount: number;
  };
}
