import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { identityRequestOrigins, profileRevalidation } from './identity-request-profile-context.ts';
import { labelRevalidationSource, profiledRevalidationSites } from './identity-request-profile-transform.ts';

test('diagnostic async origin labels preserve callback results, nested origin and concurrency isolation', async () => {
  const stack = (line: number) => `Error: PRIVATE\n    at PRIVATE (/Users/PRIVATE/packages/data/src/development-results.ts:${line}:1)`;
  const failure = new Error('PRIVATE');
  let calls = 0;
  const promise = Promise.resolve('same');
  assert.equal(profileRevalidation(stack(1), () => { calls++; return promise; })(), promise);
  assert.equal(calls, 1); assert.throws(profileRevalidation(stack(2), () => { throw failure; }), e => e === failure);
  const observed = await Promise.all([3,4].map(n => profileRevalidation(stack(n), async () => {
    await Promise.resolve();
    return profileRevalidation(stack(n+10), async () => { await Promise.resolve(); return identityRequestOrigins(); })();
  })()));
  assert.deepEqual(observed, [[3,13],[4,14]].map(pair => pair.map(n => `packages/data/src/development-results.ts:${n}`)));
  assert.deepEqual(identityRequestOrigins(), []); assert.doesNotMatch(JSON.stringify(observed), /PRIVATE|Users/);
});
test('diagnostic source labels are exact, fail closed on drift, and preserve original line count', () => {
  for (const name of profiledRevalidationSites) {
    const original = readFileSync(new URL(`../../../packages/data/src/${name}.ts`, import.meta.url), 'utf8');
    const labeled = labelRevalidationSource(name, original, 'file:///synthetic-helper.ts');
    assert.equal(labeled.split('\n').length, original.split('\n').length);
    assert.equal(labeled.split('__steerProfileRevalidation').length, 3);
    assert.throws(() => labelRevalidationSource(name, original + original, 'file:///synthetic-helper.ts'));
    assert.throws(() => labelRevalidationSource(name, '', 'file:///synthetic-helper.ts'));
  }
  assert.throws(() => labelRevalidationSource('unlisted', '.then(revalidate)', 'file:///synthetic-helper.ts'));
});
test('diagnostic preload rejects ordinary startup instead of instrumenting production', () => {
  const result = spawnSync(process.execPath, ['--import', fileURLToPath(new URL('./identity-request-profile-hooks.ts', import.meta.url)),
    '--eval', 'console.log("UNSAFE-STARTUP")'], { encoding: 'utf8' });
  assert.equal(result.status, 1); assert.doesNotMatch(result.stdout, /UNSAFE-STARTUP/);
  assert.match(result.stderr, /only with the synthetic request-profile selection/);
});
