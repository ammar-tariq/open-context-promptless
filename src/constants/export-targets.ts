export const EXPORT_TARGET_IDS = ['generic', 'react-native', 'flutter', 'swiftui'] as const;

export type ExportTargetId = (typeof EXPORT_TARGET_IDS)[number];

export type ExportTargetStatus = 'supported' | 'coming-soon';

export interface ExportTargetDefinition {
  id: ExportTargetId;
  label: string;
  description: string;
  status: ExportTargetStatus;
}

/**
 * Supported and planned export targets. Register new native platforms here.
 */
export const EXPORT_TARGETS: ExportTargetDefinition[] = [
  {
    id: 'generic',
    label: 'General',
    description:
      'Stack-agnostic context. PROMPT asks you to confirm tech stack; no RN-specific structure.',
    status: 'supported',
  },
  {
    id: 'react-native',
    label: 'React Native (unstable)',
    description:
      'Expo/RN AGENTS.md, screen folders (index.tsx + styles.ts), anti-renderer rules, navigation notes.',
    status: 'supported',
  },
  {
    id: 'flutter',
    label: 'Flutter',
    description: 'Navigator/GoRouter guidance (planned).',
    status: 'coming-soon',
  },
  {
    id: 'swiftui',
    label: 'SwiftUI',
    description: 'NavigationStack guidance (planned).',
    status: 'coming-soon',
  },
];

/** Targets shown in the plugin UI dropdown. */
export const SELECTABLE_EXPORT_TARGETS = EXPORT_TARGETS.filter(
  (target) => target.status === 'supported',
);

export const DEFAULT_EXPORT_TARGET: ExportTargetId = 'generic';

export function isSupportedExportTarget(id: string): id is ExportTargetId {
  return EXPORT_TARGETS.some((target) => target.id === id && target.status === 'supported');
}

export function getExportTargetDefinition(id: ExportTargetId): ExportTargetDefinition {
  const target = EXPORT_TARGETS.find((entry) => entry.id === id);
  if (!target) {
    throw new Error(`Unknown export target: ${id}`);
  }
  return target;
}
