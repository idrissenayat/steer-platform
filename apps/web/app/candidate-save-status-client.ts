import { candidateSaveStatusInputSchema, verifyCandidateSaveStatus, type CandidateSaveStatusInput,
  type CandidateSaveStatusOutput } from '@steer/tool-registry/candidate-save-status-contracts';
import { createReadTransport } from './read-transport.ts';

export function candidateSaveStatusFragment(raw: unknown): string {
  const value = candidateSaveStatusInputSchema.parse(raw);
  if (Object.values(value).some(part => typeof part === 'string' && /[\u0000-\u001f\u007f]/.test(part))) throw new Error('Invalid status link.');
  const fragment = `#candidate-save=${new URLSearchParams({ version: 'v1', ...value, draftRevision: String(value.draftRevision) }).toString()}`;
  if (fragment.length > 4096) throw new Error('Invalid status link.');
  return fragment;
}
export function readCandidateSaveStatusLocation(fragment: string): { kind: 'none' } | { kind: 'invalid' } | { kind: 'status'; reference: CandidateSaveStatusInput } {
  if (!fragment.startsWith('#candidate-save=')) return { kind: 'none' };
  if (fragment.length > 4096) return { kind: 'invalid' };
  try {
    const { version: _version, ...raw } = Object.fromEntries(new URLSearchParams(fragment.slice('#candidate-save='.length)));
    const reference = candidateSaveStatusInputSchema.parse({ ...raw, draftRevision: Number(raw.draftRevision) });
    return candidateSaveStatusFragment(reference) === fragment ? { kind: 'status', reference } : { kind: 'invalid' };
  } catch { return { kind: 'invalid' }; }
}
export const candidateSaveStatusMessage = (outcome: CandidateSaveStatusOutput['outcome']) => ({
  committed: 'Git confirmed the original candidate bundle. This is not gate approval or completion of workflow bookkeeping.',
  'not-found': 'No matching receipt was verified at the observed head. The save may still be unresolved; this does not authorize another submission.',
  unknown: 'The save outcome is still unknown. Do not create another submission; recheck this same operation or request reconciliation.',
  conflict: 'The original operation conflicts with the repository receipt. Reconciliation is needed; another submission is not authorized.',
})[outcome];

export function createCandidateSaveStatusClient(scope: Readonly<{ organizationId: string; repository: string }>, origin: string, transport: typeof fetch = globalThis.fetch) {
  const home = Object.freeze({ ...scope }), reader = createReadTransport(origin, transport); let closed = false;
  return {
    async read(raw: unknown) {
      try {
        const input = candidateSaveStatusInputSchema.parse(raw);
        if (closed || input.organizationId !== home.organizationId || input.repository !== home.repository) throw new Error();
        const output = verifyCandidateSaveStatus(input, await reader.request('intent.candidate.save.status', input));
        if (closed) throw new Error(); return output;
      } catch { throw new Error('Save status could not be verified. Refresh access and recheck the same operation.'); }
    },
    close() { closed = true; reader.close(); },
  };
}
