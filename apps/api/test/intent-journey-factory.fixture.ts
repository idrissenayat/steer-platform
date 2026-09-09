import { createHash, randomUUID } from 'node:crypto';
import { SCOPE_REVIEW_INSTRUCTIONS, SCOPE_REVIEW_PROFILE_REVISION } from '@steer/tool-registry/intent-scope-review';
import { intentJourneyFactoryConfigurationSchema, type IntentJourneyFactoryDependencies } from '../src/runtime.ts';
import type { IntentJourneyConfiguration } from '../src/intent-journey-services.ts';
import { binding } from '../../../packages/adapters/test/github-brief-fixture.ts';

/** Real constructors, deliberately unavailable external authorities/transports.
 * Tests explicitly replace only the capabilities they actually exercise. */
export function intentJourneyFactoryFixture(expected: IntentJourneyConfiguration = {
  organizationId: binding.organizationId, subject: 'synthetic-factory-human', productId: 'product', repository: `github:${binding.repositoryId}`,
  branch: binding.branch, configurationRevision: 'synthetic-r1', recordsPolicyDigest: 'a'.repeat(64), itemIds: ['0272-synthetic'],
}) {
  const { itemIds, ...records } = expected, state = { calls: [] as string[], closed: 0 };
  const deny = (name: string) => async (): Promise<never> => { state.calls.push(name); throw new Error('PRIVATE synthetic ' + name); };
  const budget = { organizationId: records.organizationId, subject: records.subject, configurationRevision: records.configurationRevision,
    budgetId: randomUUID(), approvalDigest: 'b'.repeat(64), capMicrousd: 1000, architectMicrousd: 100, testAgentMicrousd: 100 };
  const scopeProfile = { profileRevision: SCOPE_REVIEW_PROFILE_REVISION, instructions: SCOPE_REVIEW_INSTRUCTIONS,
    modelRoute: 'synthetic-only', maxOutputTokens: 1000, allowedResponseModels: ['synthetic-only'] };
  const roleProfile = { profileRevision: 'synthetic-role-r1', instructions: 'Synthetic role instructions',
    modelRoute: 'synthetic-only', maxOutputTokens: 1000, allowedResponseModels: ['synthetic-only'] };
  const expiresAt = new Date(Date.now() + 3600000).toISOString();
  const config = intentJourneyFactoryConfigurationSchema.parse({
    scope: { ...records, budget, expiresAt, scopeTerms: { approvalDigest: 'c'.repeat(64), amountMicrousd: 100,
      profileDigest: createHash('sha256').update(JSON.stringify(['steer-scope-review-profile/v1', scopeProfile])).digest('hex') } },
    development: { ...records, budget, expiresAt, action: 'develop' }, candidate: { ...records, budget: null, expiresAt, action: 'candidate-save' },
    scopeProfile, developmentProfiles: { architect: roleProfile, testAgent: { ...roleProfile, instructions: 'Independent synthetic Exam role' } },
    retrievalConfigurationRevision: 'synthetic-corpus-r1', publication: { organizationId: records.organizationId,
      productId: records.productId, repository: records.repository, branch: records.branch, itemIds: [...itemIds],
      serviceCommitter: 'app:synthetic-only', platformRevision: 'd'.repeat(40), gate2DecisionDigest: 'e'.repeat(64) },
  });
  const policy = deny('records-policy'), keyForDraft = deny('draft-key'), scheduler = { start: deny('workflow-start') };
  const scopeOriginals = { authorize: policy, authorizeOriginal: policy, authorizeReview: policy, authorizeDraft: policy, keyForDraft };
  const originalRecords = { authorize: policy, authorizeOriginal: policy, authorizeOperation: policy, authorizeDraft: policy,
    keyForDraft, authorizeHistoricalRead: policy };
  const developmentRecords = { originals: originalRecords, results: { authorizeOperation: policy, authorizeResult: policy,
    authorizeDraft: policy, keyForDraft, authorizeHistoricalResult: policy }, authorize: policy, authorizeHistoricalRead: policy };
  const candidateRecords = { authorize: policy, lifecycle: deny('draft-lifecycle'), keyForDraft };
  const discovery = { authorize: policy, authorizeEntry: policy };
  const deps: IntentJourneyFactoryDependencies = {
    resources: { pools: { drafts: { connect: deny('draft-sql') }, execution: { connect: deny('execution-sql') } },
      reader: { binding: { ...binding, organizationId: records.organizationId, branch: records.branch }, readHead: deny('git-head'),
        readArtifact: deny('git-artifact'), readInventory: deny('git-inventory'), readScopeInventory: deny('git-corpus'), readDirectoryInventory: deny('git-directory') },
      shutdown: async () => { state.closed++; } },
    drafts: { lifecycle: { authorize: policy }, revisions: { authorize: policy, keyForDraft } },
    discovery: { drafts: discovery, runs: discovery, scopes: discovery, admissions: discovery },
    corpus: { authorize: deny('corpus-authority'), select: deny('corpus-selection'), authorizeSource: policy },
    scope: { records: { originals: scopeOriginals, authorize: policy },
      history: { originals: scopeOriginals, authorize: policy, authorizeHistoricalRead: policy, authorizeHistoricalReview: policy },
      authorizePreparation: policy, scheduler, authorizeStart: policy },
    development: { records: developmentRecords, history: developmentRecords, authorizeReview: policy,
      authorizePreparation: policy, scheduler, authorizeStart: policy },
    candidate: { destination: { newItem: { authorize: policy, authorizeSource: policy, verify: deny('new-destination') },
      existingItem: { authorize: policy, authorizeSource: policy, verify: deny('existing-destination') } },
      authorizeReview: policy, authorizePreview: policy,
      confirmation: { authorizeConfirmation: policy, authorizeOperation: policy, records: candidateRecords },
      start: { scheduler, authorizeStart: policy, authorizeOperation: policy, records: candidateRecords },
      status: { records: { ...candidateRecords, verifyOriginal: policy },
        provider: { appJwt: deny('app-jwt'), fetch: deny('github-provider'), authorizeRead: policy } },
      publication: { authorizeRecord: policy, verifyPublicationClock: deny('publication-clock') },
      authorizeRead: policy, authorizeProposals: policy },
  };
  return { expected, records, config, deps, state };
}
