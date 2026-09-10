import assert from 'node:assert/strict';
import type { createVerifiedScopeReviewReader, createVerifiedDevelopmentHistoryReader, createRecordedDevelopmentStarter } from '../src/runtime.ts';
import { encryptedRecordGroups } from '../../../packages/data/src/records-content-codecs.ts';
import { recordsReadsetGroups } from '../../../packages/data/test/records-readset-prototype.ts';

/** Explicit disposable records/key grants, independent of source permissions and
 * execution approval. Never a production authority adapter or live activation. */
export function ownedScopeReadFixture(budgetId: string,
  keyForDraft: Parameters<typeof createVerifiedScopeReviewReader>[2]['records']['originals']['keyForDraft'],
  authorize: () => Promise<void> = async () => {}) {
  type Binding = NonNullable<Parameters<typeof createVerifiedScopeReviewReader>[2]['ownedRead']>;
  const state = { revision: 'synthetic-independent-records-r1', deniedRecord: '', deniedKey: '', discovery: 0, records: 0, keys: 0, reads: 0 };
  const provider = { async keyForDraft(reference: Parameters<typeof keyForDraft>[0], keyId: string) {
    state.reads++; return keyForDraft(reference, keyId);
  } };
  const authority: Binding['authority'] = {
    async authorizeScopeDiscovery(context) { await authorize(); state.discovery++;
      assert.equal(context.request.kind, 'scope-review'); return { permissionsRevision: state.revision, budgetId }; },
    async authorize(context) { await authorize(); assert.deepEqual(context.target.operationIds, []);
      assert.equal(context.target.budgetId, budgetId); return { permissionsRevision: state.revision }; },
    records: Object.fromEntries(recordsReadsetGroups.map(({ name }) => [name, async (context: any) => {
      await authorize(); state.records++; assert.equal(context.group, name); assert.ok(!('encrypted_value' in context.metadata));
      if (state.deniedRecord === name) throw new Error('PRIVATE independent synthetic record denied');
    }])) as Binding['authority']['records'],
  };
  const keys = Object.fromEntries(encryptedRecordGroups.map(group => [group, { provider, async authorize(context: any) {
    await authorize(); state.keys++; assert.equal(context.group, group);
    if (state.deniedKey === group) throw new Error('PRIVATE independent synthetic key denied');
  } }])) as Binding['keys'];
  return { authority, keys, state };
}

/** Distinct development discovery and grant set, not a scope/corpus grant. */
export function ownedDevelopmentReadFixture(budgetId: string,
  keyForDraft: Parameters<typeof createVerifiedScopeReviewReader>[2]['records']['originals']['keyForDraft'],
  authorize: () => Promise<void> = async () => {}) {
  const { authority: scope, keys, state } = ownedScopeReadFixture(budgetId, keyForDraft, authorize);
  state.revision = 'synthetic-independent-development-records-r1';
  type Binding = NonNullable<Parameters<typeof createVerifiedDevelopmentHistoryReader>[2]['ownedRead']>;
  const authority: Binding['authority'] = {
    async authorizeDevelopmentDiscovery(context) { await authorize(); state.discovery++;
      assert.equal(context.request.kind, 'development-history'); return { permissionsRevision: state.revision, budgetId }; },
    async authorize(context) { await authorize(); assert.equal(context.target.operationIds.length, 1);
      assert.deepEqual(context.target.reviewIds, []); assert.equal(context.target.budgetId, budgetId);
      return { permissionsRevision: state.revision }; },
    records: scope.records,
  };
  return { authority, keys, state };
}

/** Separate current-original discovery; deliberately has no history grant. */
export function ownedDevelopmentOriginalFixture(budgetId: string,
  keyForDraft: Parameters<typeof createRecordedDevelopmentStarter>[2]['records']['keyForDraft'],
  authorize: () => Promise<void> = async () => {}) {
  const { authority: history, keys, state } = ownedDevelopmentReadFixture(budgetId, keyForDraft, authorize);
  state.revision = 'synthetic-independent-development-original-r1';
  type Binding = NonNullable<Parameters<typeof createRecordedDevelopmentStarter>[2]['ownedRead']>;
  const authority: Binding['authority'] = {
    async authorizeDevelopmentOriginalDiscovery(context) { await authorize(); state.discovery++;
      assert.equal(context.request.kind, 'development-original'); return { permissionsRevision: state.revision, budgetId }; },
    authorize: history.authorize, records: history.records,
  };
  return { authority, keys, state };
}
