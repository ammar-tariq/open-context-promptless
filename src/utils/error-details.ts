import { z } from 'zod';

export interface ErrorDetails {
  code: string;
  message: string;
  details: string;
}

/**
 * Formats an unknown error into a user-facing message and a detailed debug string.
 */
export function extractErrorDetails(error: unknown, defaultCode = 'EXPORT_FAILED'): ErrorDetails {
  if (error instanceof ExportLikeError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof z.ZodError) {
    const issues = error.errors.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      return `- ${path}: ${issue.message}`;
    });

    const message = issues[0] ?? 'Export validation failed.';
    const details = [`Validation failed (${error.errors.length} issue(s)):`, ...issues].join('\n');

    return {
      code: 'VALIDATION_ERROR',
      message,
      details,
    };
  }

  if (error instanceof Error) {
    return {
      code: defaultCode,
      message: error.message || error.name || 'Export failed.',
      details: formatErrorLike(error, defaultCode),
    };
  }

  if (typeof error === 'string') {
    return {
      code: defaultCode,
      message: error,
      details: error,
    };
  }

  return {
    code: defaultCode,
    message: 'An unexpected export error occurred.',
    details: serializeUnknownError(error, defaultCode),
  };
}

export class ExportLikeError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details: string,
  ) {
    super(message);
    this.name = 'ExportLikeError';
  }
}

function formatErrorLike(error: Error, code: string): string {
  const lines = [
    `Code: ${code}`,
    `Name: ${error.name}`,
    `Message: ${error.message}`,
  ];

  if (error.stack) {
    lines.push('Stack:', error.stack);
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause !== undefined) {
    lines.push('Cause:', serializeUnknownError(cause, code));
  }

  return lines.join('\n');
}

function serializeUnknownError(error: unknown, code: string): string {
  if (error === null || error === undefined) {
    return [`Code: ${code}`, `Value: ${String(error)}`].join('\n');
  }

  if (error instanceof Error) {
    return formatErrorLike(error, code);
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

export function logExportError(error: unknown, code?: string): ErrorDetails {
  const details = extractErrorDetails(error, code);
  console.error('[OpenContext] Export failed\n', details.details);
  return details;
}
