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

export interface ScreenSummary {
  id: string;
  name: string;
  type: string;
  empty: boolean;
}

export interface PageScreensState {
  pageName: string;
  screens: ScreenSummary[];
}

function isExportableNodeType(type: string): boolean {
  return SUPPORTED_TOP_LEVEL_NODE_TYPES.includes(
    type as (typeof SUPPORTED_TOP_LEVEL_NODE_TYPES)[number],
  );
}

/**
 * Lists exportable top-level screens on the current Figma page.
 */
export function listPageScreens(): PageScreensState {
  const screens = figma.currentPage.children
    .filter((node) => isExportableNodeType(node.type))
    .map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      empty: !hasVisibleContent(node),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  return {
    pageName: figma.currentPage.name,
    screens,
  };
}

/**
 * Resolves checked screen IDs into SceneNodes for export.
 */
export async function getExportNodesByIds(screenIds: string[]): Promise<SceneNode[]> {
  if (screenIds.length === 0) {
    throw new SelectionError('Select at least one screen to export.', 'NO_SELECTION');
  }

  const nodes: SceneNode[] = [];
  const missing: string[] = [];
  const empty: string[] = [];
  const unsupported: string[] = [];

  for (const screenId of screenIds) {
    const node = await figma.getNodeByIdAsync(screenId);

    if (!node || node.type === 'PAGE' || node.type === 'DOCUMENT') {
      missing.push(screenId);
      continue;
    }

    const sceneNode = node as SceneNode;

    if (!isExportableNodeType(sceneNode.type)) {
      unsupported.push(`${sceneNode.name} (${sceneNode.type})`);
      continue;
    }

    if (!hasVisibleContent(sceneNode)) {
      empty.push(sceneNode.name);
      continue;
    }

    nodes.push(sceneNode);
  }

  if (nodes.length === 0) {
    if (empty.length > 0) {
      throw new SelectionError(
        `Selected screens appear to be empty: ${empty.join(', ')}.`,
        'EMPTY_FRAMES',
      );
    }

    if (unsupported.length > 0) {
      throw new SelectionError(
        `Unsupported screens: ${unsupported.join(', ')}.`,
        'UNSUPPORTED_NODES',
      );
    }

    throw new SelectionError(
      'Selected screens could not be found. Refresh the screen list and try again.',
      'SCREENS_NOT_FOUND',
    );
  }

  return nodes;
}

export function deriveDefaultProjectName(screenCount = 0): string {
  if (screenCount === 1) {
    const screens = listPageScreens().screens.filter((screen) => !screen.empty);
    return screens[0]?.name ?? figma.currentPage.name;
  }

  if (screenCount > 1) {
    return figma.currentPage.name;
  }

  return figma.currentPage.name || figma.root.name;
}

export function getDefaultCheckedScreenIds(screens: ScreenSummary[]): string[] {
  return screens.filter((screen) => !screen.empty).map((screen) => screen.id);
}
