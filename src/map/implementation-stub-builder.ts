import type { ScreenLayerOrderManifest } from '@/types/map';
import type { ScreenCopyManifest } from '@/types/map';
import type { ScreenMap } from '@/types/map';
import { REACT_NATIVE_VIEW_DICTIONARY } from '@/platform/react-native/view-dictionary';
import { walkMapViews } from '@/map/map-builder';

function componentNameFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function todoForViewKind(
  viewKind: string,
  name: string,
  asset?: string,
  opacity?: number,
): string {
  const entry = REACT_NATIVE_VIEW_DICTIONARY[viewKind as keyof typeof REACT_NATIVE_VIEW_DICTIONARY];
  const lib = entry ? `${entry.library}/${entry.component}` : viewKind;
  const assetNote = asset ? ` asset: ${asset}` : '';
  const opacityNote = opacity !== undefined && opacity < 1 ? ` opacity: ${opacity}` : '';

  if (viewKind === 'decorative' || viewKind === 'linearGradient' || viewKind === 'blurView') {
    return `// TODO [${viewKind}] ${name} — use ${lib} absolute layer${opacityNote}${assetNote} pointerEvents="none"`;
  }

  if (viewKind === 'text') {
    return `// TODO [text] ${name} — <Text> from copy.json binding`;
  }

  if (viewKind === 'textField') {
    return `// TODO [textField] ${name} — <TextInput> placeholder from copy.json`;
  }

  if (viewKind === 'primaryButton') {
    return `// TODO [primaryButton] ${name} — <Pressable> label from copy.json actions`;
  }

  if (viewKind === 'icon' || viewKind === 'image') {
    return `// TODO [${viewKind}] ${name} — expo-image${assetNote}`;
  }

  if (viewKind === 'bottomTabBar') {
    return `// TODO [bottomTabBar] ${name} — app-level @react-navigation/bottom-tabs NOT in this file`;
  }

  if (viewKind === 'drawerTrigger') {
    return `// TODO [drawerTrigger] ${name} — navigation.openDrawer()`;
  }

  if (viewKind === 'statusBar') {
    return `// SKIP [statusBar] ${name} — do not duplicate system chrome`;
  }

  return `// TODO [${viewKind}] ${name} — see platform/react-native/views.json#${viewKind}`;
}

/**
 * Non-runnable scaffold with TODO comments tied to map nodes — guides implementation order.
 */
export function buildImplementationStub(
  map: ScreenMap,
  copy: ScreenCopyManifest,
  layerOrder: ScreenLayerOrderManifest,
): string {
  const componentName = `${componentNameFromSlug(map.screen.slug)}Screen`;
  const todos: string[] = [];

  todos.push(`// Auto-generated stub for ${map.screen.slug} — NOT runnable. Implement src/screens/${map.screen.slug}/`);
  todos.push(`// Read: reference.png → spec.json → layer-order.json → decorative.json → copy.json bindings`);
  todos.push('');

  const bindingByNode = new Map(copy.bindings.map((b) => [b.mapNodeId, b]));

  for (const layer of layerOrder.layers) {
    if (layer.viewKind === 'container' || layer.viewKind === 'screen') {
      continue;
    }

    const binding = bindingByNode.get(layer.id);
    let line = todoForViewKind(layer.viewKind, layer.name, layer.asset, layer.opacity);

    if (binding) {
      line += ` — copy: "${binding.content}" mapNodeId: ${layer.id}`;
    }

    todos.push(line);
  }

  walkMapViews(map.views, (node) => {
    if (node.viewKind === 'container' || node.viewKind === 'screen' || node.role === 'statusBar') {
      return;
    }

    const already = todos.some((t) => t.includes(`mapNodeId: ${node.id}`) || t.includes(`[${node.viewKind}] ${node.name}`));
    if (already) {
      return;
    }

    todos.push(todoForViewKind(node.viewKind, node.name, node.asset, node.style?.opacity));
  });

  return `/**
 * IMPLEMENTATION STUB — ${map.screen.name} (\`${map.screen.slug}\`)
 *
 * This file is a checklist only. Copy patterns into:
 *   src/screens/${map.screen.slug}/index.tsx
 *   src/screens/${map.screen.slug}/styles.ts
 *
 * Forbidden: importing this stub as a component.
 */

import { View } from 'react-native';

export default function ${componentName}() {
  return (
    <View>
${todos.map((t) => `      ${t}`).join('\n')}
    </View>
  );
}
`;
}
