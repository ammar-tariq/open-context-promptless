export interface SerializedTrigger {
  type: string;
  timeout?: number;
  delay?: number;
}

export interface SerializedTransition {
  type: string;
  duration?: number;
  direction?: string;
  easing?: string;
}

export interface PrototypeLink {
  id: string;
  sourceScreenId: string;
  sourceScreenName: string;
  sourceNodeId: string;
  sourceNodeName: string;
  trigger: SerializedTrigger;
  navigation: string;
  destinationScreenId: string | null;
  destinationScreenName: string | null;
  destinationNodeId: string | null;
  transition: SerializedTransition | null;
}

export interface ParsedNavigation {
  links: PrototypeLink[];
  linkCount: number;
}
