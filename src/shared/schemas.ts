import { z } from 'zod';

const colorValueSchema = z.object({
  r: z.number(),
  g: z.number(),
  b: z.number(),
  a: z.number(),
  hex: z.string(),
});

const boundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const spacingSchema = z.object({
  top: z.number(),
  right: z.number(),
  bottom: z.number(),
  left: z.number(),
});

const semanticTextSchema = z.union([
  z.string(),
  z.object({
    content: z.string(),
    typography: z.record(z.unknown()).optional(),
    segments: z.array(z.record(z.unknown())).optional(),
  }),
]);

const semanticNodeSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    bounds: boundsSchema,
    layout: z.record(z.unknown()).optional(),
    constraints: z.record(z.unknown()).optional(),
    typography: z.record(z.unknown()).optional(),
    colors: z.record(z.unknown()).optional(),
    spacing: z.record(z.unknown()).optional(),
    effects: z.array(z.record(z.unknown())).optional(),
    borders: z.array(z.record(z.unknown())).optional(),
    cornerRadius: z.record(z.unknown()).optional(),
    variables: z.array(z.record(z.unknown())).optional(),
    text: semanticTextSchema.optional(),
    component: z
      .object({
        id: z.string(),
        name: z.string(),
        isInstance: z.boolean(),
        variants: z.record(z.string()).optional(),
      })
      .optional(),
    assets: z.array(z.record(z.unknown())).optional(),
    metadata: z.record(z.unknown()).optional(),
    children: z.array(semanticNodeSchema),
  }),
);

const navigationLinkSchema = z.object({
  id: z.string(),
  sourceScreenId: z.string(),
  sourceScreenName: z.string(),
  sourceNodeId: z.string(),
  sourceNodeName: z.string(),
  trigger: z.record(z.unknown()),
  navigation: z.string(),
  destinationScreenId: z.string().nullable(),
  destinationScreenName: z.string().nullable(),
  destinationNodeId: z.string().nullable(),
  transition: z.record(z.unknown()).nullable(),
});

export const contextDataSchema = z.object({
  exportTarget: z.string(),
  project: z.object({
    name: z.string().min(1),
    exportedAt: z.string(),
    pluginVersion: z.string(),
  }),
  metadata: z.record(z.unknown()),
  screens: z.array(semanticNodeSchema),
  navigation: z.object({
    links: z.array(navigationLinkSchema),
    linkCount: z.number().int().nonnegative(),
  }),
  platform: z.record(z.unknown()).optional(),
  components: z.array(z.record(z.unknown())),
  tokens: z.object({
    colors: z.array(z.record(z.unknown())),
    typography: z.array(z.record(z.unknown())),
    fonts: z.array(z.record(z.unknown())).optional(),
    spacing: z.array(z.record(z.unknown())),
  }),
  assets: z.object({
    images: z.array(z.record(z.unknown())),
    icons: z.array(z.record(z.unknown())),
  }),
  summary: z.object({
    screenCount: z.number().int().nonnegative(),
    componentCount: z.number().int().nonnegative(),
    imageCount: z.number().int().nonnegative(),
    iconCount: z.number().int().nonnegative().optional(),
    exportedAssetCount: z.number().int().nonnegative().optional(),
    textElementCount: z.number().int().nonnegative(),
    nodeCount: z.number().int().nonnegative(),
    navigationLinkCount: z.number().int().nonnegative().optional(),
  }),
});

export type ContextData = z.infer<typeof contextDataSchema>;

export function validateContextData(data: unknown): ContextData {
  return contextDataSchema.parse(data);
}

export const projectNameSchema = z
  .string()
  .trim()
  .min(1, 'Project name is required')
  .max(100, 'Project name must be 100 characters or fewer');

export function validateProjectName(name: string): string {
  return projectNameSchema.parse(name);
}

export { colorValueSchema, boundsSchema, spacingSchema };
