import assert from 'node:assert/strict';
import { createIntentDraftService } from '@steer/data/intent-draft-service';
import type { CandidateSaveReviewInput, CandidateSaveReviewOutput } from '@steer/tool-registry/candidate-save-review-contracts';
import type { IntentScopeReader } from '@steer/tool-registry/intent-scope-read-contracts';
import { createRecordedCandidateSaveReviewer, createCorpusRecordedDevelopmentReviewer, createVerifiedScopeReviewReader } from '../src/runtime.ts';
import { withReviewReadSession } from '../../../packages/data/src/review-read-session.ts';
import { ownedScopeReadFixture } from './owned-scope-read.fixture.ts';
import type { scopeDraftIntegrationFixture } from '../../../packages/data/test/scope-originals.integration.ts';
import type { nativeCandidateJourneyFixture } from './native-candidate-journey.fixture.ts';

/** Real native scope/draft records and corpus; disposable grants and keys only.
 * No mutations, reservations, models or candidate-save execution are available. */
export async function testOwnedSaveReview(f: Awaited<ReturnType<typeof scopeDraftIntegrationFixture>>,
  native: ReturnType<typeof nativeCandidateJourneyFixture>, profiles: NonNullable<Parameters<typeof createVerifiedScopeReviewReader>[2]['ownedRead']>['profiles'],
  input: CandidateSaveReviewInput, expected: CandidateSaveReviewOutput) {
  const setup = (mode: string, finalKey?: () => Promise<void>) => {
    let scopeKeys = 0, draftKeys = 0, callerAllowed = true, draftAllowed = true, sourceAllowed = true;
    const current = async () => { if (!callerAllowed) throw new Error('PRIVATE revoked caller'); };
    const binding = ownedScopeReadFixture(f.execution.budget.budgetId, async (...args) => {
      const value = await f.deps.keyForDraft(...args); scopeKeys++;
      if (scopeKeys === 2) {
        if (mode === 'record') binding.state.deniedRecord = 'scope_observations';
        if (mode === 'key') binding.state.deniedKey = 'scope_observations';
        if (mode === 'revision') binding.state.revision = 'changed-records-revision';
        if (mode === 'caller') callerAllowed = false;
        if (mode === 'draft') draftAllowed = false;
        if (mode === 'source') sourceAllowed = false;
        if (mode === 'method') scope.read = async () => { throw new Error('Replaced current method'); };
        await finalKey?.();
        if (mode === 'rotated-key') return { ...value, bytes: new Uint8Array(32) };
      }
      return value;
    });
    const scope = createVerifiedScopeReviewReader(f.pools, f.config, { records: { originals: f.deps, authorize: current },
      profile: f.described.original.profile, ownedRead: { ...binding, profiles } });
    const rawDrafts = createIntentDraftService(f.pools.drafts, f.config, { lifecycle: { authorize: current }, revisions: {
      authorize: async () => { await current(); if (!draftAllowed) throw new Error('PRIVATE draft revoked'); }, keyForDraft: async (...args) => {
        const value = await f.deps.keyForDraft(...args); draftKeys++;
        if (draftKeys === 2) {
          if (mode === 'draft-final-grant') draftAllowed = false;
          if (mode === 'draft-final-caller') callerAllowed = false;
          if (mode === 'draft-final-close') review.close();
          if (mode === 'draft-final-method') rawDrafts.read = async () => { throw new Error('PRIVATE changed draft read'); };
          if (mode === 'draft-final-key') return { ...value, bytes: new Uint8Array(32) };
        }
        return value;
      },
    } });
    const reader = native.reader(f.config.organizationId);
    const sources = createCorpusRecordedDevelopmentReviewer(reader, f.config, 'synthetic-native-corpus-r1', {
      drafts: rawDrafts, authorizeReview: current, authority: { ...native.corpusAuthority,
        authorizeSource: async context => { if (!sourceAllowed) throw new Error('PRIVATE corpus source revoked'); await native.corpusAuthority.authorizeSource(context); },
      },
    });
    const wrapped: IntentScopeReader = { scope: scope.scope, read: (input, current) => scope.read(input, current) };
    const wrappedSources = { scope: sources.scope, review: (input: Parameters<typeof sources.review>[0], current: () => Promise<void>) => sources.review(input, current) };
    const deps = { drafts: rawDrafts, sources: mode === 'wrapped-source' ? wrappedSources : sources, scopeReview: mode === 'wrapped' ? wrapped : scope, authorizeReview: current };
    const review = createRecordedCandidateSaveReviewer(f.config, deps);
    return { scope, rawDrafts, sources, review, current, binding, scopeKeys: () => scopeKeys, draftKeys: () => draftKeys,
      async close() { review.close(); rawDrafts.close(); sources.close(); scope.close();
        if ('shutdown' in sources) await sources.shutdown(); if ('shutdown' in scope) await scope.shutdown(); },
    };
  };
  for (const mode of ['exact', 'wrapped', 'wrapped-source', 'record', 'key', 'revision', 'caller', 'draft', 'source', 'method', 'rotated-key',
    'draft-final-grant', 'draft-final-caller', 'draft-final-close', 'draft-final-method', 'draft-final-key']) {
    const s = setup(mode);
    try {
      if (mode === 'exact' || mode === 'wrapped' || mode === 'wrapped-source') {
        if (mode === 'exact') await withReviewReadSession(s.review, input, s.current, async read => {
          assert.equal(s.scopeKeys(), 0, 'No assessment IO before the dependent caller requests its first review');
          assert.deepEqual(await read(s.current), expected); assert.equal(s.scopeKeys(), 1);
          assert.deepEqual(await read(s.current), expected); assert.equal(s.scopeKeys(), 1);
        }, task => task, () => {});
        else assert.deepEqual(await s.review.review(input, s.current), expected);
        assert.equal(s.scopeKeys(), mode === 'wrapped' ? 4 : 2);
        assert.equal(s.draftKeys(), mode === 'wrapped-source' ? 10 : 2);
      } else {
        await assert.rejects(s.review.review(input, s.current), /unavailable/, mode);
        if (mode.startsWith('draft-final-')) assert.equal(s.draftKeys(), 2, 'Final key fault must actually execute');
      }
    } finally { await s.close(); }
  }
  let entered!: () => void, release!: () => void, settled = false;
  const reached = new Promise<void>(resolve => { entered = resolve; }), held = new Promise<void>(resolve => { release = resolve; });
  const s = setup('held', async () => { entered(); await held; });
  const result = withReviewReadSession(s.review, input, s.current, async read => { assert.deepEqual(await read(s.current), expected); },
    task => task, () => {}).then(() => assert.fail('Closed scope returned'), () => {}).finally(() => { settled = true; });
  try {
    await reached; s.scope.close(); s.review.close(); await new Promise(resolve => setImmediate(resolve)); assert.equal(settled, false);
    release(); await result; assert.equal(s.scopeKeys(), 2);
  } finally { release(); await result; await s.close(); }
  console.log('PASS owned final-save assessment: two scope-key reads instead of four, two shared draft-key reads versus ten with wrapped sources, exact output parity, thirteen final-key denial cases and held-scope drainage before source owner completion');
}
