import { slugify } from '@/utils/color';

/**
 * Converts a Figma screen name into a PascalCase route/component name.
 */
export function toRouteName(name: string): string {
  const slug = slugify(name);
  if (!slug) {
    return 'Screen';
  }

  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Converts a screen name into a camelCase navigator param key.
 */
export function toRouteParamKey(name: string): string {
  const routeName = toRouteName(name);
  return routeName.charAt(0).toLowerCase() + routeName.slice(1);
}
