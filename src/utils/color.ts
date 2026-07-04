import type { ColorValue } from '@/types';

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Converts a Figma RGB color (0–1 range) to a normalized ColorValue.
 */
export function rgbToColorValue(color: RgbColor, opacity = 1): ColorValue {
  const r = clampColorChannel(color.r);
  const g = clampColorChannel(color.g);
  const b = clampColorChannel(color.b);
  const a = clampAlpha(opacity);

  return {
    r,
    g,
    b,
    a,
    hex: rgbaToHex(r, g, b, a),
  };
}

function clampColorChannel(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 255);
}

function clampAlpha(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
}

function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const hex = [r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('');
  if (a >= 1) {
    return `#${hex}`;
  }
  const alpha = Math.round(a * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${hex}${alpha}`;
}

/**
 * Returns true when a node has meaningful visible content.
 */
export function hasVisibleContent(node: SceneNode): boolean {
  if (!node.visible) {
    return false;
  }

  if ('opacity' in node && node.opacity === 0) {
    return false;
  }

  if ('children' in node && node.children.length > 0) {
    return node.children.some((child) => hasVisibleContent(child));
  }

  if (node.type === 'TEXT') {
    return node.characters.trim().length > 0;
  }

  return true;
}

/**
 * Safely reads bound variables from a node when the Figma API supports them.
 */
export function getBoundVariables(node: SceneNode): VariableAlias[] {
  if (!('boundVariables' in node) || !node.boundVariables) {
    return [];
  }

  const aliases: VariableAlias[] = [];
  const bound = node.boundVariables as Record<string, VariableAlias | VariableAlias[]>;

  for (const value of Object.values(bound)) {
    if (Array.isArray(value)) {
      aliases.push(...value);
    } else if (value) {
      aliases.push(value);
    }
  }

  return aliases;
}

/**
 * Counts nodes matching a predicate in a tree.
 */
export function countNodes(node: { children?: { length: number }[] | readonly unknown[] }, predicate: (node: unknown) => boolean, root: unknown = node): number {
  let count = predicate(root) ? 1 : 0;

  if ('children' in (node as object) && Array.isArray((node as { children: unknown[] }).children)) {
    for (const child of (node as { children: unknown[] }).children) {
      count += countNodes(child as { children?: unknown[] }, predicate, child);
    }
  }

  return count;
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatExportDate(date: Date): string {
  return date.toISOString();
}

/**
 * Formats a date for human-readable export output.
 * Avoids Intl APIs because Figma's plugin sandbox does not provide them.
 */
export function formatHumanDate(date: Date): string {
  const month = MONTH_NAMES[date.getMonth()] ?? 'Unknown';
  const day = date.getDate();
  const year = date.getFullYear();
  const hours24 = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;

  return `${month} ${day}, ${year} at ${hours12}:${minutes} ${period}`;
}
