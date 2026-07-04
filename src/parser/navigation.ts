import type { ParsedScreen } from '@/types';
import type { ParsedNavigation, PrototypeLink, SerializedTransition, SerializedTrigger } from '@/types/navigation';

/**
 * Collects Figma prototype links between exported screens from node reactions.
 */
export async function collectNavigationLinks(
  screens: ParsedScreen[],
  rootNodes: readonly SceneNode[],
): Promise<ParsedNavigation> {
  const screenMap = new Map(screens.map((screen) => [screen.id, screen]));
  const links: PrototypeLink[] = [];
  const seen = new Set<string>();

  const walk = async (node: SceneNode, screenId: string, screenName: string): Promise<void> => {
    if ('reactions' in node && node.reactions.length > 0) {
      for (const reaction of node.reactions) {
        const actions = getReactionActions(reaction);

        for (const action of actions) {
          if (action.type !== 'NODE') {
            continue;
          }

          const destination = await resolveDestinationScreen(action.destinationId, screenMap);
          const trigger = serializeTrigger(reaction.trigger);
          const linkId = `${node.id}:${action.destinationId ?? 'none'}:${trigger.type}`;

          if (seen.has(linkId)) {
            continue;
          }
          seen.add(linkId);

          links.push({
            id: linkId,
            sourceScreenId: screenId,
            sourceScreenName: screenName,
            sourceNodeId: node.id,
            sourceNodeName: node.name,
            trigger,
            navigation: action.navigation,
            destinationScreenId: destination?.screenId ?? null,
            destinationScreenName: destination?.screenName ?? null,
            destinationNodeId: action.destinationId,
            transition: serializeTransition(action.transition),
          });
        }
      }
    }

    if ('children' in node) {
      for (const child of node.children) {
        if (!child.visible) {
          continue;
        }
        await walk(child, screenId, screenName);
      }
    }
  };

  for (const root of rootNodes) {
    const screen = screenMap.get(root.id);
    if (!screen) {
      continue;
    }
    await walk(root, screen.id, screen.name);
  }

  return {
    links,
    linkCount: links.length,
  };
}

function getReactionActions(reaction: Reaction): Action[] {
  if (reaction.actions && reaction.actions.length > 0) {
    return [...reaction.actions];
  }

  if (reaction.action) {
    return [reaction.action];
  }

  return [];
}

async function resolveDestinationScreen(
  destinationId: string | null,
  screenMap: Map<string, ParsedScreen>,
): Promise<{ screenId: string; screenName: string } | null> {
  if (!destinationId) {
    return null;
  }

  const directMatch = screenMap.get(destinationId);
  if (directMatch) {
    return { screenId: directMatch.id, screenName: directMatch.name };
  }

  const node = await figma.getNodeByIdAsync(destinationId);
  if (!node) {
    return null;
  }

  let current: BaseNode | null = node;
  while (current) {
    const screenMatch = screenMap.get(current.id);
    if (screenMatch) {
      return { screenId: screenMatch.id, screenName: screenMatch.name };
    }
    current = current.parent;
  }

  return null;
}

function serializeTrigger(trigger: Trigger | null): SerializedTrigger {
  if (!trigger) {
    return { type: 'UNKNOWN' };
  }

  const serialized: SerializedTrigger = { type: trigger.type };

  if ('timeout' in trigger && typeof trigger.timeout === 'number') {
    serialized.timeout = trigger.timeout;
  }

  if ('delay' in trigger && typeof trigger.delay === 'number') {
    serialized.delay = trigger.delay;
  }

  return serialized;
}

function serializeTransition(transition: Transition | null): SerializedTransition | null {
  if (!transition) {
    return null;
  }

  const serialized: SerializedTransition = {
    type: transition.type,
    duration: transition.duration,
  };

  if ('direction' in transition) {
    serialized.direction = transition.direction;
  }

  if ('easing' in transition && transition.easing) {
    serialized.easing = transition.easing.type;
  }

  return serialized;
}

export { collectNavigationLinks as parseNavigationLinks };
