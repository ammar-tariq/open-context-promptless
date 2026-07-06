import { ASSET_ICON_DIR, ASSET_IMAGE_DIR } from '@/constants';
import type { AssetReference, ContextPackageFile, ParsedDesign } from '@/types';
import { slugify } from '@/utils';
import { bytesToBase64, mimeTypeForImageExtension } from '@/utils/base64';

const RASTER_EXPORT_SCALE = 2;

export interface SkippedAssetExport {
  nodeId: string;
  name: string;
  kind: 'image' | 'icon';
  reason: string;
}

export interface AssetExportResult {
  files: ContextPackageFile[];
  exportedAssetCount: number;
  deduplicatedAssetCount: number;
  skippedAssets: SkippedAssetExport[];
  nodeExportPaths: Map<string, string>;
  nodeRasterExportPaths: Map<string, string>;
}

interface AssetExportProgress {
  (stage: string, progress: number): void;
}

interface ExportCandidate {
  reference: AssetReference;
  nodeId: string;
  kind: 'image' | 'icon';
}

interface DedupGroup {
  key: string;
  representative: ExportCandidate;
  nodeIds: string[];
}

interface ExportedAssetPaths {
  vectorPath?: string;
  rasterPath?: string;
  files: ContextPackageFile[];
}

/**
 * Exports cropped raster assets and vector/icon files from the parsed design.
 * Deduplicates shared images (by hash) and repeated component icons.
 */
export interface AssetExportOptions {
  /** React Native exports: PNG only under assets/images/ — no SVG */
  rasterOnly?: boolean;
}

export async function exportDesignAssets(
  design: ParsedDesign,
  onProgress?: AssetExportProgress,
  options: AssetExportOptions = {},
): Promise<AssetExportResult> {
  const rasterOnly = options.rasterOnly ?? false;
  const files: ContextPackageFile[] = [];
  const skippedAssets: SkippedAssetExport[] = [];
  const usedFileNames = new Set<string>();
  const nodeExportPaths = new Map<string, string>();
  const nodeRasterExportPaths = new Map<string, string>();
  const exportedByKey = new Map<string, ExportedAssetPaths>();

  const candidates = [
    ...collectExportCandidates(design.images, 'image'),
    ...collectExportCandidates(design.icons, 'icon'),
  ];

  const groups = await buildDedupGroups(candidates);
  const deduplicatedAssetCount = Math.max(0, candidates.length - groups.length);

  const totalSteps = groups.reduce((count, group) => {
    if (group.representative.kind === 'icon') {
      return count + (rasterOnly ? 1 : 2);
    }
    return count + 1;
  }, 0);

  let completedSteps = 0;

  const report = (stage: string): void => {
    const progress = totalSteps === 0 ? 0.9 : 0.85 + (completedSteps / totalSteps) * 0.1;
    onProgress?.(stage, progress);
  };

  for (const group of groups) {
    const candidate = group.representative;
    const exported: ExportedAssetPaths = { files: [] };

    if (candidate.kind === 'image') {
      report(`Exporting image ${completedSteps + 1} of ${totalSteps || 1}`);
      const rasterExport = await exportCroppedRaster(candidate, usedFileNames, skippedAssets);
      if (rasterExport) {
        exported.files.push(rasterExport.file);
        exported.rasterPath = rasterExport.exportPath;
      }
      completedSteps += 1;
    } else {
      if (!rasterOnly) {
        report(`Exporting icon SVG ${completedSteps + 1} of ${totalSteps || 1}`);
        const svgExport = await exportIconSvg(candidate, usedFileNames, skippedAssets);
        if (svgExport) {
          exported.files.push(svgExport.file);
          exported.vectorPath = svgExport.exportPath;
        }
        completedSteps += 1;
      }

      report(`Exporting icon PNG ${completedSteps + 1} of ${totalSteps || 1}`);
      const rasterExport = await exportCroppedRaster(
        {
          ...candidate,
          reference: {
            ...candidate.reference,
            name: `${candidate.reference.name}-icon`,
          },
        },
        usedFileNames,
        skippedAssets,
        'png',
      );
      if (rasterExport) {
        exported.files.push(rasterExport.file);
        exported.rasterPath = rasterExport.exportPath;
      }
      completedSteps += 1;
    }

    exportedByKey.set(group.key, exported);
    files.push(...exported.files);
    applyExportedPaths(group.nodeIds, exported, nodeExportPaths, nodeRasterExportPaths);
  }

  if (skippedAssets.length > 0) {
    console.warn(
      `[OpenContext] Skipped ${skippedAssets.length} asset export(s):\n` +
        skippedAssets
          .map((asset) => `- ${asset.name} (${asset.nodeId}, ${asset.kind}): ${asset.reason}`)
          .join('\n'),
    );
  }

  if (deduplicatedAssetCount > 0) {
    console.info(
      `[OpenContext] Reused exports for ${deduplicatedAssetCount} duplicate asset reference(s).`,
    );
  }

  return {
    files,
    exportedAssetCount: files.length,
    deduplicatedAssetCount,
    skippedAssets,
    nodeExportPaths,
    nodeRasterExportPaths,
  };
}

export function enrichDesignWithAssetPaths(
  design: ParsedDesign,
  nodeExportPaths: Map<string, string>,
  nodeRasterExportPaths: Map<string, string>,
  options: AssetExportOptions = {},
): ParsedDesign {
  const rasterOnly = options.rasterOnly ?? false;
  const enrichAsset = (asset: AssetReference): AssetReference => {
    const vectorPath = nodeExportPaths.get(asset.id);
    const rasterPath = nodeRasterExportPaths.get(asset.id);

    if (!vectorPath && !rasterPath) {
      return asset;
    }

    const vectorExtension = vectorPath?.split('.').pop();
    const rasterExtension = rasterPath?.split('.').pop() ?? 'png';

    return {
      ...asset,
      exportPath: rasterOnly
        ? (rasterPath ?? vectorPath ?? asset.exportPath)
        : (vectorPath ?? rasterPath ?? asset.exportPath),
      rasterExportPath: rasterPath ?? asset.rasterExportPath,
      mimeType: rasterOnly
        ? mimeTypeForImageExtension('png')
        : vectorPath
          ? 'image/svg+xml'
          : mimeTypeForImageExtension(rasterExtension === 'jpeg' ? 'jpg' : rasterExtension),
      rasterMimeType: rasterPath
        ? mimeTypeForImageExtension(rasterExtension === 'jpeg' ? 'jpg' : rasterExtension)
        : asset.rasterMimeType,
      format: vectorExtension ?? rasterExtension ?? asset.format,
      cropped: Boolean(rasterPath ?? vectorPath),
    };
  };

  const enrichNode = (
    node: ParsedDesign['screens'][number]['root'],
  ): ParsedDesign['screens'][number]['root'] => ({
    ...node,
    assets: node.assets?.map(enrichAsset),
    children: node.children.map(enrichNode),
  });

  return {
    ...design,
    images: design.images.map(enrichAsset),
    icons: design.icons.map(enrichAsset),
    screens: design.screens.map((screen) => ({
      ...screen,
      root: enrichNode(screen.root),
    })),
  };
}

function applyExportedPaths(
  nodeIds: string[],
  exported: ExportedAssetPaths,
  nodeExportPaths: Map<string, string>,
  nodeRasterExportPaths: Map<string, string>,
): void {
  for (const nodeId of nodeIds) {
    if (exported.vectorPath) {
      nodeExportPaths.set(nodeId, exported.vectorPath);
    }
    if (exported.rasterPath) {
      nodeRasterExportPaths.set(nodeId, exported.rasterPath);
    }
  }
}

async function buildDedupGroups(candidates: ExportCandidate[]): Promise<DedupGroup[]> {
  const groupMap = new Map<string, DedupGroup>();

  for (const candidate of candidates) {
    const key = await resolveDedupKey(candidate);
    const existing = groupMap.get(key);

    if (existing) {
      existing.nodeIds.push(candidate.nodeId);
      continue;
    }

    groupMap.set(key, {
      key,
      representative: candidate,
      nodeIds: [candidate.nodeId],
    });
  }

  return Array.from(groupMap.values());
}

async function resolveDedupKey(candidate: ExportCandidate): Promise<string> {
  if (candidate.kind === 'image') {
    if (candidate.reference.hash) {
      return `image-hash:${candidate.reference.hash}`;
    }
    return `image-node:${candidate.nodeId}`;
  }

  const node = await figma.getNodeByIdAsync(candidate.nodeId);
  if (node?.type === 'INSTANCE') {
    try {
      const mainComponent = await node.getMainComponentAsync();
      if (mainComponent) {
        return `icon-component:${mainComponent.id}`;
      }
    } catch {
      // Fall through to node-based key.
    }
  }

  if (node && isVectorLikeNode(node.type)) {
    const bounds = 'width' in node && 'height' in node ? `${node.width}x${node.height}` : 'unknown';
    const signature = slugify(candidate.reference.name) || 'icon';
    return `icon-vector:${signature}:${bounds}`;
  }

  return `icon-node:${candidate.nodeId}`;
}

function isVectorLikeNode(type: string): boolean {
  return (
    type === 'VECTOR' ||
    type === 'BOOLEAN_OPERATION' ||
    type === 'STAR' ||
    type === 'LINE' ||
    type === 'POLYGON' ||
    type === 'ELLIPSE'
  );
}

function collectExportCandidates(
  assets: AssetReference[],
  kind: ExportCandidate['kind'],
): ExportCandidate[] {
  return assets.map((reference) => ({
    reference,
    nodeId: reference.id,
    kind,
  }));
}

async function exportCroppedRaster(
  candidate: ExportCandidate,
  usedFileNames: Set<string>,
  skippedAssets: SkippedAssetExport[],
  forcedExtension = 'png',
): Promise<{ file: ContextPackageFile; exportPath: string } | null> {
  const bytes = await exportNodeRaster(candidate, skippedAssets);
  if (!bytes || bytes.length === 0) {
    return null;
  }

  const fileName = createUniqueAssetFileName(candidate.reference.name, forcedExtension, usedFileNames);
  const exportPath = `${ASSET_IMAGE_DIR}/${fileName}`;

  return {
    exportPath,
    file: {
      path: exportPath,
      content: bytesToBase64(bytes),
      encoding: 'base64',
    },
  };
}

async function exportIconSvg(
  candidate: ExportCandidate,
  usedFileNames: Set<string>,
  skippedAssets: SkippedAssetExport[],
): Promise<{ file: ContextPackageFile; exportPath: string } | null> {
  const node = await resolveExportNode(candidate.nodeId);
  if (!node || !('exportAsync' in node)) {
    recordSkippedAsset(skippedAssets, candidate, 'Node is missing or cannot be exported.');
    return null;
  }

  let bytes: Uint8Array;
  try {
    bytes = await node.exportAsync({ format: 'SVG' });
  } catch (error) {
    recordSkippedAsset(skippedAssets, candidate, formatExportFailure(error));
    return null;
  }

  if (!bytes || bytes.length === 0) {
    recordSkippedAsset(skippedAssets, candidate, 'SVG export returned empty bytes.');
    return null;
  }

  const fileName = createUniqueAssetFileName(candidate.reference.name, 'svg', usedFileNames);
  const exportPath = `${ASSET_ICON_DIR}/${fileName}`;

  return {
    exportPath,
    file: {
      path: exportPath,
      content: bytesToBase64(bytes),
      encoding: 'base64',
    },
  };
}

async function exportNodeRaster(
  candidate: ExportCandidate,
  skippedAssets: SkippedAssetExport[],
): Promise<Uint8Array | null> {
  const hashBytes = await exportImageHashBytes(candidate.reference.hash);
  if (hashBytes) {
    return hashBytes;
  }

  const node = await resolveExportNode(candidate.nodeId);
  if (!node || !('exportAsync' in node)) {
    recordSkippedAsset(skippedAssets, candidate, 'Node is missing or cannot be exported.');
    return null;
  }

  if (!hasNonZeroBounds(node)) {
    recordSkippedAsset(skippedAssets, candidate, 'Node has zero size.');
    return null;
  }

  try {
    return await node.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: RASTER_EXPORT_SCALE },
    });
  } catch (error) {
    recordSkippedAsset(skippedAssets, candidate, formatExportFailure(error));
    return null;
  }
}

async function resolveExportNode(nodeId: string): Promise<(SceneNode & ExportMixin) | null> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || node.type === 'PAGE' || !('exportAsync' in node) || !('visible' in node) || !node.visible) {
    return null;
  }

  return node as SceneNode & ExportMixin;
}

function hasNonZeroBounds(node: SceneNode): boolean {
  if (!('width' in node) || !('height' in node)) {
    return true;
  }

  return node.width > 0.01 && node.height > 0.01;
}

async function exportImageHashBytes(imageHash?: string): Promise<Uint8Array | null> {
  if (!imageHash) {
    return null;
  }

  try {
    const image = figma.getImageByHash(imageHash);
    if (!image) {
      return null;
    }

    const bytes = await image.getBytesAsync();
    return bytes.length > 0 ? bytes : null;
  } catch {
    return null;
  }
}

function recordSkippedAsset(
  skippedAssets: SkippedAssetExport[],
  candidate: ExportCandidate,
  reason: string,
): void {
  skippedAssets.push({
    nodeId: candidate.nodeId,
    name: candidate.reference.name,
    kind: candidate.kind,
    reason,
  });
}

function formatExportFailure(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown export error';
}

function createUniqueAssetFileName(
  name: string,
  extension: string,
  usedFileNames: Set<string>,
): string {
  const baseName = slugify(name) || 'asset';
  let fileName = `${baseName}.${extension}`;
  let suffix = 2;

  while (usedFileNames.has(fileName)) {
    fileName = `${baseName}-${suffix}.${extension}`;
    suffix += 1;
  }

  usedFileNames.add(fileName);
  return fileName;
}
