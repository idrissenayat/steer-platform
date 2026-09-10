import assert from 'node:assert/strict';
import type { createVerifiedScopeReviewReader } from '../src/runtime.ts';
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
