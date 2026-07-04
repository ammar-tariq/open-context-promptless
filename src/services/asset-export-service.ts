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

/**
 * Exports cropped raster assets and vector/icon files from the parsed design.
 */
export async function exportDesignAssets(
  design: ParsedDesign,
  onProgress?: AssetExportProgress,
): Promise<AssetExportResult> {
  const files: ContextPackageFile[] = [];
  const skippedAssets: SkippedAssetExport[] = [];
  const usedFileNames = new Set<string>();
  const nodeExportPaths = new Map<string, string>();
  const nodeRasterExportPaths = new Map<string, string>();

  const candidates = [
    ...collectExportCandidates(design.images, 'image'),
    ...collectExportCandidates(design.icons, 'icon'),
  ];

  const totalSteps = candidates.reduce((count, candidate) => {
    return count + (candidate.kind === 'icon' ? 2 : 1);
  }, 0);

  let completedSteps = 0;

  const report = (stage: string): void => {
    const progress = totalSteps === 0 ? 0.9 : 0.85 + (completedSteps / totalSteps) * 0.1;
    onProgress?.(stage, progress);
  };

  for (const candidate of candidates) {
    if (candidate.kind === 'image') {
      report(`Exporting cropped image ${completedSteps + 1} of ${totalSteps || 1}`);
      const exported = await exportCroppedRaster(candidate, usedFileNames, skippedAssets);
      if (exported) {
        files.push(exported.file);
        nodeRasterExportPaths.set(candidate.nodeId, exported.exportPath);
      }
      completedSteps += 1;
      continue;
    }

    report(`Exporting icon SVG ${completedSteps + 1} of ${totalSteps || 1}`);
    const svgExport = await exportIconSvg(candidate, usedFileNames, skippedAssets);
    if (svgExport) {
      files.push(svgExport.file);
      nodeExportPaths.set(candidate.nodeId, svgExport.exportPath);
    }
    completedSteps += 1;

    report(`Exporting icon image ${completedSteps + 1} of ${totalSteps || 1}`);
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
      files.push(rasterExport.file);
      nodeRasterExportPaths.set(candidate.nodeId, rasterExport.exportPath);
    }
    completedSteps += 1;
  }

  if (skippedAssets.length > 0) {
    console.warn(
      `[OpenContext] Skipped ${skippedAssets.length} asset export(s):\n` +
        skippedAssets
          .map((asset) => `- ${asset.name} (${asset.nodeId}, ${asset.kind}): ${asset.reason}`)
          .join('\n'),
    );
  }

  return {
    files,
    exportedAssetCount: files.length,
    skippedAssets,
    nodeExportPaths,
    nodeRasterExportPaths,
  };
}

export function enrichDesignWithAssetPaths(
  design: ParsedDesign,
  nodeExportPaths: Map<string, string>,
  nodeRasterExportPaths: Map<string, string>,
): ParsedDesign {
  const enrichAsset = (asset: AssetReference): AssetReference => {
    const vectorPath = nodeExportPaths.get(asset.id);
    const rasterPath = nodeRasterExportPaths.get(asset.id);
    const isIcon = asset.role === 'icon-vector' || asset.format === 'vector';

    if (!vectorPath && !rasterPath) {
      return asset;
    }

    const vectorExtension = vectorPath?.split('.').pop();
    const rasterExtension = rasterPath?.split('.').pop() ?? 'png';

    return {
      ...asset,
      exportPath: vectorPath ?? rasterPath ?? asset.exportPath,
      rasterExportPath: isIcon ? rasterPath : rasterPath ?? asset.rasterExportPath,
      mimeType: vectorPath
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

function collectExportCandidates(
  assets: AssetReference[],
  kind: ExportCandidate['kind'],
): ExportCandidate[] {
  const seen = new Set<string>();

  return assets
    .filter((asset) => {
      if (seen.has(asset.id)) {
        return false;
      }
      seen.add(asset.id);
      return true;
    })
    .map((reference) => ({
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
  const node = await resolveExportNode(candidate.nodeId);
  if (!node || !('exportAsync' in node)) {
    const hashBytes = await exportImageHashBytes(candidate.reference.hash);
    if (hashBytes) {
      return hashBytes;
    }
    recordSkippedAsset(skippedAssets, candidate, 'Node is missing or cannot be exported.');
    return null;
  }

  if (!hasNonZeroBounds(node)) {
    const hashBytes = await exportImageHashBytes(candidate.reference.hash);
    if (hashBytes) {
      return hashBytes;
    }
    recordSkippedAsset(skippedAssets, candidate, 'Node has zero size.');
    return null;
  }

  try {
    return await node.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: RASTER_EXPORT_SCALE },
    });
  } catch (error) {
    const hashBytes = await exportImageHashBytes(candidate.reference.hash);
    if (hashBytes) {
      console.warn(
        `[OpenContext] Cropped export failed for "${candidate.reference.name}" (${candidate.nodeId}); used embedded image bytes instead.`,
      );
      return hashBytes;
    }

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
