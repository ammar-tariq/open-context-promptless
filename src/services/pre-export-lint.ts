import { getExportNodesByIds } from '@/services/selection-service';
import type { VariantExportMode } from '@/types/map';
import { normalizeScreenName } from '@/utils/screen-slug';

export interface PreExportLintIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  screenId?: string;
  screenName?: string;
}

export interface PreExportLintResult {
  issueCount: number;
  errors: number;
  warnings: number;
  issues: PreExportLintIssue[];
}

function countDescendants(node: SceneNode): number {
  if (!('children' in node)) {
    return 1;
  }
  return 1 + node.children.reduce((sum, child) => sum + countDescendants(child), 0);
}

function scanNodeForDecorative(node: SceneNode, issues: PreExportLintIssue[], screenName: string, screenId: string): void {
  if (!('children' in node)) {
    return;
  }

  for (const child of node.children) {
    if (child.type === 'ELLIPSE' && 'opacity' in child && typeof child.opacity === 'number' && child.opacity < 0.85) {
      issues.push({
        severity: 'info',
        code: 'DECORATIVE_ELLIPSE',
        message: `"${child.name}" is a low-opacity ellipse — will export as decorative PNG (do not use solid View)`,
        screenId,
        screenName,
      });
    }

    if (child.type === 'TEXT' && child.fontName !== figma.mixed && child.fontName.family === 'Mixed') {
      issues.push({
        severity: 'warning',
        code: 'MIXED_FONTS',
        message: `Text "${child.name}" uses mixed fonts — verify typography in export`,
        screenId,
        screenName,
      });
    }

    scanNodeForDecorative(child, issues, screenName, screenId);
  }
}

/**
 * Lightweight pre-export checks — runs before full parse/export.
 */
export async function runPreExportLint(input: {
  selectedScreenIds: string[];
  variantMode: VariantExportMode;
  canonicalOverrides?: Record<string, string>;
}): Promise<PreExportLintResult> {
  const issues: PreExportLintIssue[] = [];

  if (input.selectedScreenIds.length === 0) {
    return {
      issueCount: 1,
      errors: 1,
      warnings: 0,
      issues: [{ severity: 'error', code: 'NO_SELECTION', message: 'Select at least one screen to export' }],
    };
  }

  const nodes = await getExportNodesByIds(input.selectedScreenIds);

  if (input.variantMode === 'canonical') {
    const grouped = new Map<string, SceneNode[]>();
    for (const node of nodes) {
      const key = normalizeScreenName(node.name);
      const bucket = grouped.get(key) ?? [];
      bucket.push(node);
      grouped.set(key, bucket);
    }

    let skipped = 0;
    for (const [, group] of grouped) {
      if (group.length > 1) {
        skipped += group.length - 1;
      }
    }

    if (skipped > 0) {
      issues.push({
        severity: 'info',
        code: 'VARIANTS_SKIPPED',
        message: `${skipped} duplicate frame(s) will be skipped (canonical mode)`,
      });
    }
  }

  if (input.variantMode === 'all') {
    const nameCounts = new Map<string, number>();
    for (const node of nodes) {
      const key = normalizeScreenName(node.name);
      nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    }

    for (const [name, count] of nameCounts) {
      if (count > 1) {
        issues.push({
          severity: 'warning',
          code: 'DUPLICATE_NAMES',
          message: `${count} frames named "${name}" — read spec.json screenKind per slug (suffixes are not wizard steps)`,
        });
      }
    }
  }

  for (const node of nodes) {
    const nodeCount = countDescendants(node);
    if (nodeCount <= 1) {
      issues.push({
        severity: 'error',
        code: 'EMPTY_SCREEN',
        message: `"${node.name}" appears empty — nothing to export`,
        screenId: node.id,
        screenName: node.name,
      });
    }

    if ('width' in node && (node.width < 200 || node.height < 200)) {
      issues.push({
        severity: 'warning',
        code: 'SMALL_FRAME',
        message: `"${node.name}" is ${Math.round(node.width)}×${Math.round(node.height)} — verify frame size`,
        screenId: node.id,
        screenName: node.name,
      });
    }

    scanNodeForDecorative(node, issues, node.name, node.id);
  }

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;

  return {
    issueCount: issues.length,
    errors,
    warnings,
    issues,
  };
}
