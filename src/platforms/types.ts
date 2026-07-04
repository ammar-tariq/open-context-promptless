import type { ExportTargetId } from '@/constants/export-targets';
import type { ParsedDesign } from '@/types';
import type { SemanticDesign } from '@/types/semantic';
import type { Exporter } from '@/exporters/base';

export interface PlatformAdapter {
  readonly id: ExportTargetId;
  readonly label: string;
  readonly status: 'supported' | 'coming-soon';
  enhanceSemantic(semantic: SemanticDesign, design: ParsedDesign): SemanticDesign;
  getAdditionalExporters?(): Exporter[];
}
