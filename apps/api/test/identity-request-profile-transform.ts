/** Test loader allowlist: only label the existing revalidation scheduling sites.
 * Missing/duplicated anchors reject; line counts and all guards stay unchanged. */
export const profiledRevalidationSites = Object.freeze([
  'intent-scope-starter', 'intent-development-history-reader', 'intent-development-starter',
  'intent-development-reader', 'scope-review-reader', 'candidate-save-starter',
  'scope-review-history-reader', 'candidate-save-preparer', 'intent-development-preparer',
  'intent-scope-preparer', 'intent-admission-discovery', 'candidate-save-previewer',
]);
export function labelRevalidationSource(name: string, source: string, helperUrl: string): string {
  if (!profiledRevalidationSites.includes(name)) throw new Error('Unlisted diagnostic module.');
  const anchor = name === 'candidate-save-previewer' ? 'bounded(revalidate)' : '.then(revalidate)';
  if (source.split(anchor).length !== 2 || source.includes('__steerProfileRevalidation')) throw new Error('Diagnostic anchor changed.');
  return `import { profileRevalidation as __steerProfileRevalidation } from ${JSON.stringify(helperUrl)};`
    + source.replace(anchor, anchor.replace('revalidate', '__steerProfileRevalidation(new Error().stack, revalidate)'));
}
