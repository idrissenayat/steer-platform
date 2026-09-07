import assert from 'node:assert/strict';
import test from 'node:test';
import { briefFragment, readBriefLocation, briefReceiptFragment } from '../app/brief-location.ts';

const value = { organizationId: 'org', repository: 'github:1', path: 'intent/0053/BRIEF.md', revision: 'a'.repeat(40), contentDigest: 'b'.repeat(64) };

test('Brief locations round-trip exact scope/path/revision/fingerprint as bounded metadata only', () => {
  for (const selection of [value, { ...value, path: 'BRIEF.md', organizationId: '組織 with space' },
    { ...value, path: 'items/0125-canonical-outcome/BRIEF.md' },
    { ...value, organizationId: '組'.repeat(200), path: `intent/${'1'.repeat(479)}/BRIEF.md` }]) {
    const fragment = briefFragment(selection); assert.ok(fragment.length <= 4096);
    assert.deepEqual(readBriefLocation(fragment), { kind: 'brief', selection });
  }
  for (const extra of ['subject', 'hats', 'content', 'accessToken']) assert.throws(() => briefFragment({ ...value, [extra]: 'not-allowed' }));
});

test('Brief locations reject partial, duplicate, extra, malformed, alternate and oversized encodings', () => {
  const canonical = briefFragment(value);
  for (const fragment of [canonical + '&path=BRIEF.md', canonical + '&token=secret', canonical.replace('v1', 'v2'),
    canonical.replace('org&', '%6Frg&'), canonical.replace('%2F', '%2f'), canonical.replace('github%3A1', '%ZZ'),
    canonical.replace('&digest=', '&omitted='), '#brief=v1&' + 'x'.repeat(4096), '#brief='])
    assert.deepEqual(readBriefLocation(fragment), { kind: 'invalid' });
  for (const selection of [{ ...value, repository: 'https://outside.example' }, { ...value, path: '../BRIEF.md' },
    { ...value, revision: value.revision + '\n' }, { ...value, organizationId: 'org\n' }]) assert.throws(() => briefFragment(selection));
});

test('unrelated and empty fragments are not interpreted as Brief authority or a navigation target', () => {
  for (const fragment of ['', '#', '#inbox', 'https://outside.example', '#other=brief', '#%62rief=v1'])
    assert.deepEqual(readBriefLocation(fragment), { kind: 'none' });
});

test('only strict committed receipts create exact recorded references without identity, operation or authority fields', () => {
  const result = { outcome: 'committed', organizationId: 'org', repository: 'github:1', branch: 'codex/fixture',
    path: 'items/0157-fixture/BRIEF.md', revision: 'a'.repeat(40), contentDigest: 'b'.repeat(64), subject: 'synthetic',
    idempotencyKey: '15700000-0000-4000-8000-000000000001', requestDigest: 'c'.repeat(64), expectedHead: 'd'.repeat(40), blobSha: 'e'.repeat(40) };
  const output = { result, gateSigned: false };
  const fragment = briefReceiptFragment(output);
  assert.deepEqual(readBriefLocation(fragment), { kind: 'brief', selection: { organizationId: result.organizationId,
    repository: result.repository, path: result.path, revision: result.revision, contentDigest: result.contentDigest } });
  for (const excluded of ['subject', 'idempotencyKey', 'requestDigest', 'expectedHead', 'gateSigned', 'branch', 'blobSha']) assert.ok(!fragment.includes(excluded));
  assert.ok(!fragment.includes(result.subject)); assert.ok(!fragment.includes(result.idempotencyKey));
  for (const bad of [null, { ...output, gateSigned: true }, { ...output, extra: 'private' },
    { ...output, result: { ...result, token: 'private' } }, { ...output, result: { ...result, revision: 'bad' } },
    { ...output, result: { ...result, repository: 'https://outside.invalid' } }]) assert.equal(briefReceiptFragment(bad), null);
  const { revision, contentDigest, expectedHead, blobSha, requestDigest, outcome, ...reference } = result;
  for (const next of ['not-found', 'unknown', 'conflict', 'pending']) assert.equal(briefReceiptFragment({ gateSigned: false,
    result: { ...reference, outcome: next, ...(next === 'pending' ? { requestDigest } : {}) } }), null);
});
