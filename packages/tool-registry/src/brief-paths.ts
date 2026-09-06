import { z } from 'zod';

// One portable definition for newly authored Briefs. Read compatibility must not
// silently widen this create-only target contract.
export const canonicalBriefPathSchema = z.string().max(300)
  .regex(/^items\/[0-9]{4,}-[a-z0-9]+(?:-[a-z0-9]+)*\/BRIEF\.md(?![\s\S])/);
export const readableBriefPathSchema = z.union([canonicalBriefPathSchema,
  z.string().max(500).regex(/^(?:BRIEF\.md|intent\/[0-9]{4,}\/BRIEF\.md)(?![\s\S])/),
]);
