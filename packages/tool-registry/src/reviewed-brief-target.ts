import { z } from 'zod';

const bundleId=z.uuid().length(36).refine(v=>v===v.toLowerCase());
/** Parse a reviewed source without rewriting its versioned path into a root.
 * This is identity syntax, never proof of current scope, lifecycle or access. */
export function reviewedItemBriefTarget(path:string) {
  const match=/^items\/([0-9]{4}-[a-z0-9]+(?:-[a-z0-9]+)*)(?:\/candidates\/([a-f0-9-]{36}))?\/BRIEF\.md(?![\s\S])/.exec(path);
  if(!match||(match[2]&&!bundleId.safeParse(match[2]).success))return null;
  return {itemId:match[1]!,bundleId:match[2]??null};
}
export const reviewedCandidateBriefPathSchema=z.string().max(400).refine(path=>!!reviewedItemBriefTarget(path)?.bundleId);
