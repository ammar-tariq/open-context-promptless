import type { ExportTargetId } from '@/constants/export-targets';
import { UI_HEIGHT, UI_WIDTH } from '@/constants';
import { createMessage } from '@/types/messages';
import type { GenerateErrorPayload, PluginMessage } from '@/types/messages';
import {
  deriveDefaultProjectName,
  generateContextPackage,
  getDefaultCheckedScreenIds,
  listPageScreens,
  SelectionError,
  ExportError,
} from '@/services';
import { extractErrorDetails } from '@/utils/error-details';

figma.showUI(__html__, {
  width: UI_WIDTH,
  height: UI_HEIGHT,
  themeColors: true,
});

// Keep node IDs collected during parse reachable for exportAsync.
figma.skipInvisibleInstanceChildren = false;

function postToUi(message: PluginMessage): void {
  figma.ui.postMessage(message);
}

function postExportError(error: unknown): void {
  const payload = toGenerateErrorPayload(error);
  console.error('[OpenContext] Export failed\n', payload.details);
  postToUi(createMessage('GENERATE_ERROR', payload));
}

function toGenerateErrorPayload(error: unknown): GenerateErrorPayload {
  if (error instanceof ExportError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof SelectionError) {
    return {
      code: error.code,
      message: error.message,
      details: [`Code: ${error.code}`, `Message: ${error.message}`].join('\n'),
    };
  }

  return extractErrorDetails(error, 'UNKNOWN_ERROR');
}

function sendInitState(): void {
  const { pageName, screens } = listPageScreens();
  const defaultCheckedScreenIds = getDefaultCheckedScreenIds(screens);

  postToUi(
    createMessage('INIT_RESPONSE', {
      pageName,
      screens,
      defaultProjectName: deriveDefaultProjectName(defaultCheckedScreenIds.length),
      defaultCheckedScreenIds,
    }),
  );
}

figma.on('currentpagechange', () => {
  sendInitState();
});

figma.ui.onmessage = async (message: PluginMessage) => {
  switch (message.type) {
    case 'INIT': {
      sendInitState();
      break;
    }

    case 'GENERATE_CONTEXT': {
      const payload = message.payload as
        | {
            projectName?: string;
            exportTarget?: string;
            selectedScreenIds?: string[];
          }
        | undefined;
      const projectName = payload?.projectName;
      const exportTarget = payload?.exportTarget ?? 'generic';
      const selectedScreenIds = payload?.selectedScreenIds;
      if (!projectName || typeof projectName !== 'string') {
        postExportError(new ExportError('Project name is required.', 'INVALID_PROJECT_NAME'));
        break;
      }

      if (typeof exportTarget !== 'string') {
        postExportError(new ExportError('Export target is required.', 'INVALID_EXPORT_TARGET'));
        break;
      }

      if (!Array.isArray(selectedScreenIds) || selectedScreenIds.length === 0) {
        postExportError(new ExportError('Select at least one screen to export.', 'NO_SELECTION'));
        break;
      }

      try {
        const result = await generateContextPackage(
          projectName,
          exportTarget as ExportTargetId,
          selectedScreenIds,
          (stage, progress) => {
            postToUi(createMessage('GENERATE_PROGRESS', { stage, progress }));
          },
        );

        postToUi(
          createMessage('GENERATE_SUCCESS', {
            zipBase64: result.zipBase64,
            zipFileName: result.zipFileName,
            summary: result.summary,
          }),
        );
      } catch (error) {
        postExportError(error);
      }
      break;
    }

    case 'RESIZE_UI': {
      const payload = message.payload as { width?: number; height?: number } | undefined;
      const width = payload?.width;
      const height = payload?.height;
      if (typeof width === 'number' && typeof height === 'number') {
        figma.ui.resize(width, height);
      }
      break;
    }

    default:
      break;
  }
};

sendInitState();
