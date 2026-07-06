import { slugify } from '@/utils/color';

/**
 * Builds unique URL-safe slugs for screens within an export batch.
 */
export function buildScreenSlugMap(
  screens: Array<{ id: string; name: string }>,
): Map<string, string> {
  const slugMap = new Map<string, string>();
  const used = new Map<string, number>();

  for (const screen of screens) {
    const base = slugify(screen.name) || 'screen';
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    const slug = count === 0 ? base : `${base}-${count + 1}`;
    slugMap.set(screen.id, slug);
  }

  return slugMap;
}

export function normalizeScreenName(name: string): string {
  return name.trim().toLowerCase();
}
