import type { ExportFilePayload } from '@/types/messages';

let activeExportRoot: FileSystemDirectoryHandle | null = null;

export function isFolderExportSupported(): boolean {
  return typeof window.showDirectoryPicker === 'function';
}

export function setActiveExportDirectory(handle: FileSystemDirectoryHandle | null): void {
  activeExportRoot = handle;
}

export async function requestExportDirectory(): Promise<FileSystemDirectoryHandle> {
  const picker = window.showDirectoryPicker;
  if (!picker) {
    throw new Error(
      'Folder export is not supported in this Figma environment. Use Figma desktop in Chromium.',
    );
  }

  return picker.call(window, { mode: 'readwrite' });
}

export async function writeExportFile(payload: ExportFilePayload): Promise<void> {
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

export function clearActiveExportDirectory(): void {
  activeExportRoot = null;
}
