import { useEffect } from 'react';
import { createMessage } from '@/types/messages';
import type {
  ExportFilePayload,
  GenerateErrorPayload,
  InitResponsePayload,
  PluginMessage,
} from '@/types/messages';
import {
  cancelExportDelivery,
  deliverExportFile,
  finalizeExportDelivery,
} from '@/ui/utils/export-delivery';
import { usePluginStore } from '@/ui/store/plugin-store';

const FIGMA_ORIGIN = 'https://www.figma.com';

function isInitResponsePayload(payload: unknown): payload is InitResponsePayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'pageName' in payload &&
    'screens' in payload &&
    'defaultProjectName' in payload &&
    'defaultCheckedScreenIds' in payload &&
    'duplicateGroups' in payload
  );
}

function isGenerateErrorPayload(payload: unknown): payload is GenerateErrorPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'code' in payload &&
    'message' in payload &&
    'details' in payload
  );
}

function isExportFilePayload(payload: unknown): payload is ExportFilePayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'folderName' in payload &&
    'path' in payload &&
    'content' in payload
  );
}

/**
 * Bridges Figma plugin messages with the React UI store.
 */
export function usePluginMessaging(): void {
  const { setScreensState, setProgress, setSuccess, setError } = usePluginStore();

  useEffect(() => {
    const handleMessage = async (event: MessageEvent<{ pluginMessage: PluginMessage }>) => {
      const message = event.data.pluginMessage;
      if (!message) return;

      switch (message.type) {
        case 'INIT_RESPONSE':
          if (isInitResponsePayload(message.payload)) {
            setScreensState(message.payload);
          }
          break;
        case 'GENERATE_PROGRESS':
          if (message.payload && 'stage' in message.payload) {
            setProgress(message.payload.stage, message.payload.progress);
          }
          break;
        case 'EXPORT_FILE':
          if (isExportFilePayload(message.payload)) {
            try {
              await deliverExportFile(message.payload);
            } catch (error) {
              cancelExportDelivery();
              setError({
                code: 'EXPORT_WRITE_FAILED',
                message:
                  error instanceof Error ? error.message : 'Failed to write export files.',
                details: error instanceof Error ? error.stack ?? error.message : String(error),
              });
            }
          }
          break;
        case 'GENERATE_SUCCESS':
          if (
            message.payload &&
            'summary' in message.payload &&
            'folderName' in message.payload &&
            'fileCount' in message.payload
          ) {
            try {
              setProgress('Preparing download…', 0.995);
              await finalizeExportDelivery(message.payload.folderName);
              const starterPrompt =
                'starterPrompt' in message.payload && typeof message.payload.starterPrompt === 'string'
                  ? message.payload.starterPrompt
                  : '';
              setSuccess(message.payload.summary, starterPrompt);
            } catch (error) {
              cancelExportDelivery();
              setError({
                code: 'EXPORT_DOWNLOAD_FAILED',
                message:
                  error instanceof Error
                    ? error.message
                    : 'Failed to prepare the context package download.',
                details: error instanceof Error ? error.stack ?? error.message : String(error),
              });
            }
          }
          break;
        case 'GENERATE_ERROR':
          if (isGenerateErrorPayload(message.payload)) {
            console.error('[OpenContext UI] Export failed\n', message.payload.details);
            cancelExportDelivery();
            setError(message.payload);
          }
          break;
        default:
          break;
      }
    };

    window.onmessage = handleMessage;
    requestScreenListRefresh();

    return () => {
      window.onmessage = null;
    };
  }, [setScreensState, setProgress, setSuccess, setError]);
}

export function requestScreenListRefresh(): void {
  postPluginMessage(createMessage('INIT'));
}

export function postPluginMessage(message: PluginMessage): void {
  parent.postMessage({ pluginMessage: message }, FIGMA_ORIGIN);
}
