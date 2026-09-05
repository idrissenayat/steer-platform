import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { identityView, sessionView, repositoryView } from '../app/identity-view.ts';

test('public identity view is explicitly enabled only for valid HTTPS configuration', () => {
  assert.deepEqual(identityView('enabled', 'https://steer.example', 'https://id.example/realm'), { origin: 'https://steer.example', issuerOrigin: 'https://id.example' });
  for (const [enabled, origin, issuer] of [[undefined, undefined, undefined], ['true', 'https://steer.example', 'https://id.example'],
    ['enabled', 'http://steer.example', 'https://id.example'], ['enabled', 'https://steer.example/path', 'https://id.example'],
    ['enabled', 'https://steer.example', 'https://user:secret@id.example'], ['enabled', 'https://steer.example', 'https://id.example?code=x']]) {
    assert.equal(identityView(enabled, origin, issuer), null);
  }
});

test('sign-in page uses native fixed-path forms, with no browser credential or script dependency', async () => {
  const source = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /action="\/auth\/login" method="post"/); assert.match(source, /action="\/auth\/logout" method="post"/);
  assert.match(source, /await connection\(\)/);
  assert.doesNotMatch(source, /use client|localStorage|sessionStorage|clientSecret|privateKey|NEXT_PUBLIC_|onSubmit/);
});

test('session display parser accepts only bounded unexpired display fields, never credentials', () => {
  const now = Date.now(); const value = { subject: 'synthetic-account', organizationId: 'synthetic-org', hats: ['product-lead'], expiresAt: new Date(now + 60000).toISOString() };
  const encode = (input) => encodeURIComponent(JSON.stringify(input));
  assert.deepEqual(sessionView(encode(value), now), value);
  for (const invalid of [{ ...value, accessToken: 'secret' }, { ...value, subject: '' }, { ...value, subject: 'x'.repeat(201) },
    { ...value, hats: ['<script>'] }, { ...value, hats: Array(9).fill('product-lead') }, { ...value, expiresAt: 'invalid' },
    { ...value, expiresAt: new Date(now).toISOString() }, [], null]) assert.equal(sessionView(encode(invalid), now), null);
  for (const invalid of [null, '%malformed', 'x'.repeat(8193)]) assert.equal(sessionView(invalid, now), null);
});

test('repository display accepts only a bounded provider scope ID, not a path, URL or credential', () => {
  assert.equal(repositoryView('github:1'), 'github:1');
  for (const value of [null, '', 'https://github.com/a/b', 'a/b', 'github:1\n', 'github:' + '1'.repeat(161), 'Bearer secret'])
    assert.equal(repositoryView(value), null);
});
