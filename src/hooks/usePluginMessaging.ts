import { useEffect } from 'react';
import { createMessage } from '@/types/messages';
import type {
  GenerateErrorPayload,
  InitResponsePayload,
  PluginMessage,
} from '@/types/messages';
import { downloadZipArchive } from '@/ui/utils/download';
import { usePluginStore } from '@/ui/store/plugin-store';

const FIGMA_ORIGIN = 'https://www.figma.com';

function isInitResponsePayload(payload: unknown): payload is InitResponsePayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'pageName' in payload &&
    'screens' in payload &&
    'defaultProjectName' in payload &&
    'defaultCheckedScreenIds' in payload
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
        case 'GENERATE_SUCCESS':
          if (
            message.payload &&
            'summary' in message.payload &&
            'zipBase64' in message.payload &&
            'zipFileName' in message.payload
          ) {
            setSuccess(message.payload.summary);
            downloadZipArchive(message.payload.zipBase64, message.payload.zipFileName);
          }
          break;
        case 'GENERATE_ERROR':
          if (isGenerateErrorPayload(message.payload)) {
            console.error('[OpenContext UI] Export failed\n', message.payload.details);
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
