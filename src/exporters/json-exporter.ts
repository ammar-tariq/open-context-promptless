import { EXPORT_FILE_NAMES } from '@/constants';
import { validateContextData } from '@/shared/schemas';
import type { ExportContext } from './base';
import { BaseExporter } from './base';

/**
 * Exports normalized design data as structured JSON.
 */
export class JsonExporter extends BaseExporter {
  readonly id = 'json';
  readonly fileName = EXPORT_FILE_NAMES.DATA;

  export(context: ExportContext) {
    const validated = validateContextData(context.semantic);
    const content = JSON.stringify(validated, null, 2);
    return this.buildFile(content);
  }
}
