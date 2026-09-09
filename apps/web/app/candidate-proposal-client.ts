import { candidateProposalInputSchema, verifyCandidateProposals, type CandidateProposalInput } from '@steer/tool-registry/candidate-proposal-contracts';
import { createReadTransport } from './read-transport.ts';

export function createCandidateProposalClient(origin: string, transport: typeof fetch = fetch) {
  const reader = createReadTransport(origin, transport); let closed = false;
  return {
    async list(raw: CandidateProposalInput) {
      const input = candidateProposalInputSchema.parse(raw);
      const output = verifyCandidateProposals(input, await reader.request('intent.candidate.proposals', input));
      if (closed) throw new Error('Proposal selection is unavailable.'); return output;
    },
    close() { closed = true; reader.close(); },
  };
}
