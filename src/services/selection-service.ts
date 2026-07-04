import { SUPPORTED_TOP_LEVEL_NODE_TYPES } from '@/constants';
import { hasVisibleContent } from '@/utils';

export class SelectionError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'SelectionError';
  }
}

export interface SelectedNodeSummary {
  name: string;
  type: string;
  exportable: boolean;
}

export interface SelectionSummary {
  count: number;
  exportableCount: number;
  names: string[];
  items: SelectedNodeSummary[];
}

function isExportableNodeType(type: string): boolean {
  return SUPPORTED_TOP_LEVEL_NODE_TYPES.includes(
    type as (typeof SUPPORTED_TOP_LEVEL_NODE_TYPES)[number],
  );
}

/**
 * Validates and returns top-level frame selections from the current Figma document.
 */
export function getSelectedExportNodes(): SceneNode[] {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new SelectionError(
      'Select one or more top-level frames, sections, or components to export.',
      'NO_SELECTION',
    );
  }

  const unsupported = selection.filter((node) => !isExportableNodeType(node.type));

  if (unsupported.length > 0) {
    const names = unsupported.map((node) => `${node.name} (${node.type})`).join(', ');
    throw new SelectionError(
      `Unsupported selection: ${names}. Choose frames, sections, components, or instances.`,
      'UNSUPPORTED_NODES',
    );
  }

  const emptyNodes = selection.filter((node) => !hasVisibleContent(node));
  if (emptyNodes.length === selection.length) {
    throw new SelectionError(
      'Selected frames appear to be empty. Add visible content before exporting.',
      'EMPTY_FRAMES',
    );
  }

  return [...selection];
}

export function getSelectionSummary(): SelectionSummary {
  const selection = figma.currentPage.selection;
  const items = selection.map((node) => ({
    name: node.name,
    type: node.type,
    exportable: isExportableNodeType(node.type),
  }));

  return {
    count: selection.length,
    exportableCount: items.filter((item) => item.exportable).length,
    names: selection.map((node) => node.name),
    items,
  };
}

export function deriveDefaultProjectName(): string {
  const selection = figma.currentPage.selection;
  if (selection.length === 1) {
    return selection[0]?.name ?? figma.currentPage.name;
  }
  if (selection.length > 1) {
    return figma.currentPage.name;
  }
  return figma.root.name;
}
