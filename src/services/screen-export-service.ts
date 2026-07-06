import { bytesToBase64 } from '@/utils/base64';

const REFERENCE_EXPORT_SCALE = 2;

export interface ReferenceExportResult {
  path: string;
  content: string;
  encoding: 'base64';
}

/**
 * Exports a full-frame reference PNG for visual QA.
 */
export async function exportScreenReference(
  node: SceneNode,
  slug: string,
): Promise<ReferenceExportResult> {
  const bytes = await node.exportAsync({
    format: 'PNG',
    constraint: { type: 'SCALE', value: REFERENCE_EXPORT_SCALE },
  });

  return {
    path: `screens/${slug}/reference.png`,
    content: bytesToBase64(bytes),
    encoding: 'base64',
  };
}
