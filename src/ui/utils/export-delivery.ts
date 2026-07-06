import JSZip from 'jszip';
import type { ExportFilePayload } from '@/types/messages';

let activeExportRoot: FileSystemDirectoryHandle | null = null;
let deliveryMode: 'folder' | 'zip' = 'zip';
let zipFiles: ExportFilePayload[] = [];

export function isFolderExportSupported(): boolean {
  return typeof window.showDirectoryPicker === 'function';
}

export function getExportDeliveryMode(): 'folder' | 'zip' {
  return deliveryMode;
}

/**
 * Picks a folder when the browser allows it, otherwise falls back to zip download.
 */
export async function beginExportDelivery(): Promise<'folder' | 'zip'> {
  zipFiles = [];
  clearActiveExportDirectory();

  if (isFolderExportSupported()) {
    try {
      const picker = window.showDirectoryPicker;
      if (picker) {
        activeExportRoot = await picker.call(window, { mode: 'readwrite' });
        deliveryMode = 'folder';
        return 'folder';
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      // Fall back to zip when folder picker fails (common in Figma's plugin iframe).
    }
  }

  deliveryMode = 'zip';
  return 'zip';
}

export async function deliverExportFile(payload: ExportFilePayload): Promise<void> {
  if (deliveryMode === 'folder') {
    await writeExportFile(payload);
    return;
  }

  zipFiles.push(payload);
}

export async function finalizeExportDelivery(folderName: string): Promise<void> {
  if (deliveryMode === 'folder') {
    clearActiveExportDirectory();
    return;
  }

  const zip = new JSZip();
  const folder = zip.folder(folderName);

  if (!folder) {
    throw new Error('Failed to create zip folder for context package.');
  }

  for (const file of zipFiles) {
    if (file.encoding === 'base64') {
      folder.file(file.path, file.content, { base64: true });
      continue;
    }

    folder.file(file.path, file.content);
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  downloadBlob(blob, `${folderName}.zip`);
  zipFiles = [];
}

export function cancelExportDelivery(): void {
  zipFiles = [];
  clearActiveExportDirectory();
}

async function writeExportFile(payload: ExportFilePayload): Promise<void> {
  if (!activeExportRoot) {
    throw new Error('Export directory is not set.');
  }

  const contextDir = await activeExportRoot.getDirectoryHandle(payload.folderName, {
    create: true,
  });

  const parts = payload.path.split('/').filter(Boolean);
  const fileName = parts.pop();

  if (!fileName) {
    throw new Error(`Invalid export path: ${payload.path}`);
  }

  let currentDir = contextDir;
  for (const part of parts) {
    currentDir = await currentDir.getDirectoryHandle(part, { create: true });
  }

  const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();

  if (payload.encoding === 'base64') {
    const binary = atob(payload.content);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    await writable.write(bytes);
  } else {
    await writable.write(payload.content);
  }

  await writable.close();
}

function clearActiveExportDirectory(): void {
  activeExportRoot = null;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
