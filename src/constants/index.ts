export const PLUGIN_NAME = 'OpenContext';
export const PLUGIN_VERSION = '1.0.0';
export const CONTEXT_FOLDER_NAME = 'context';

export const UI_WIDTH = 360;
export const UI_HEIGHT = 480;

export const SUPPORTED_TOP_LEVEL_NODE_TYPES = ['FRAME', 'COMPONENT', 'INSTANCE', 'SECTION'] as const;

export const SEMANTIC_NODE_TYPES = [
  'Screen',
  'Container',
  'Section',
  'Group',
  'Button',
  'Text',
  'Input',
  'Avatar',
  'Icon',
  'Image',
  'Card',
  'Navigation',
  'Divider',
  'List',
  'Grid',
  'Component',
  'Frame',
  'Unknown',
] as const;

export const EXPORT_FILE_NAMES = {
  README: 'README.md',
  DATA: 'data.json',
} as const;

export * from './assets';
