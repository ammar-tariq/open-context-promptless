import JSZip from 'jszip';
import { CONTEXT_FOLDER_NAME } from '@/constants';
import type { ContextPackage } from '@/types';

/**
 * Builds a zip archive in the plugin thread to avoid postMessage payload limits.
 */
export async function createContextZipBase64(contextPackage: ContextPackage): Promise<string> {
  const zip = new JSZip();
  const folder = zip.folder(contextPackage.folderName);

  if (!folder) {
    throw new Error('Failed to create zip folder for context package.');
  }

  for (const file of contextPackage.files) {
    if (file.encoding === 'base64') {
      folder.file(file.path, file.content, { base64: true });
      continue;
    }

    folder.file(file.path, file.content);
  }

  return zip.generateAsync({ type: 'base64' });
}

export function getContextZipFileName(folderName = CONTEXT_FOLDER_NAME): string {
  return `${folderName}.zip`;
}
