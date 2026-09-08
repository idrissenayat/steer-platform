import { candidateBundleReadInputSchema, type CandidateBundleReadInput } from '@steer/tool-registry/candidate-bundle-read-contracts';

/** Reference metadata only: never document prose, credentials, consent or access. */
export function candidateFragment(raw: unknown): string {
  const value = candidateBundleReadInputSchema.parse(raw);
  if (Object.values(value).some(part => /[\u0000-\u001f\u007f]/.test(part))) throw new Error('Invalid candidate link.');
  const fragment = `#candidate=${new URLSearchParams({ version: 'v1', ...value }).toString()}`;
  if (fragment.length > 4096) throw new Error('Invalid candidate link.');
  return fragment;
}
export function readCandidateLocation(fragment: string): { kind: 'none' } | { kind: 'invalid' } | { kind: 'candidate'; reference: CandidateBundleReadInput } {
  if (!fragment.startsWith('#candidate=')) return { kind: 'none' };
  if (fragment.length > 4096) return { kind: 'invalid' };
  try {
    const values = Object.fromEntries(new URLSearchParams(fragment.slice('#candidate='.length)));
    const { version: _version, ...raw } = values;
    const reference = candidateBundleReadInputSchema.parse(raw);
    if (candidateFragment(reference) !== fragment) return { kind: 'invalid' };
    return { kind: 'candidate', reference };
  } catch { return { kind: 'invalid' }; }
}
