import assert from 'node:assert/strict';
import test from 'node:test';
import { briefFragment, readBriefLocation } from '../app/brief-location.ts';

const value = { organizationId: 'org', repository: 'github:1', path: 'intent/0053/BRIEF.md', revision: 'a'.repeat(40), contentDigest: 'b'.repeat(64) };

test('Brief locations round-trip exact scope/path/revision/fingerprint as bounded metadata only', () => {
  for (const selection of [value, { ...value, path: 'BRIEF.md', organizationId: '組織 with space' },
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
