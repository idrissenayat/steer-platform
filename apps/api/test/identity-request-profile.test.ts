import assert from 'node:assert/strict';
import test from 'node:test';
import { createIdentityRequestProfile, identityRequestFrames } from './identity-request-profile.ts';

test('identity profiles retain only bounded production module locations, never raw stacks or private strings', () => {
  const secret = 'PRIVATE-CREDENTIAL-SOURCE-IDENTITY';
  const stack = `Error: ${secret}\n    at ${secret} (/Users/${secret}/packages/data/src/development-results.ts:42:9)\n    at ${secret} (file:///Users/${secret}/apps/api/src/runtime.ts:99:1)\n    at ${secret} (/Users/${secret}/elsewhere/key.ts:1:2)\n${secret}\n    at /packages/data/src/../secret.ts:2:1\n    at /packages/data/src/private.ts:0:0`;
  assert.deepEqual(identityRequestFrames(stack), ['packages/data/src/development-results.ts:42', 'apps/api/src/runtime.ts:99']);
  assert.doesNotMatch(JSON.stringify(identityRequestFrames(stack)), /PRIVATE|Users|elsewhere|secret/);
  assert.equal(identityRequestFrames(`Error\n${'    at /packages/data/src/draft-revisions.ts:42:1\n'.repeat(100)}`).length, 64);
  assert.deepEqual(identityRequestFrames(null), []); assert.deepEqual(identityRequestFrames({}), []);
});
test('profile windows preserve transport identity and every request, including failures and unclassified stacks', async () => {
  const secret = 'PRIVATE-REQUEST-DATA', input = new Request(`https://synthetic.invalid/repos/${secret}/repo/git/ref/heads/main`),
    init = { headers: { authorization: secret }, method: 'GET' }, response = new Response(secret), promise = Promise.resolve(response);
  let calls = 0; const profile = createIdentityRequestProfile((request, options) => {
    calls++; assert.equal(request, input); assert.equal(options, init); return promise;
  });
  assert.equal(profile.transport(input, init), promise); assert.equal(profile.outsideWindows(), 1);
  const window = profile.begin(); assert.throws(() => profile.begin()); const limit = Error.stackTraceLimit;
  for (let i = 0; i < 4; i++) assert.equal(profile.transport(input, init), promise);
  assert.equal(Error.stackTraceLimit, limit); assert.equal(await promise, response);
  const result = window.finish(); assert.equal(result.attempts, 4); assert.equal(result.groups.reduce((n, g) => n + g.attempts, 0), 4);
  assert.equal(result.groups.reduce((n, g) => n + g.counts.head, 0), 4); assert.equal(calls, 5);
  assert.equal(result.captureErrors, 0); assert.equal(result.overflow, 0); assert.throws(() => window.finish());
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|synthetic.invalid|authorization|Users/);
  assert.ok(Object.isFrozen(result.groups)); assert.ok(result.groups.every(g => Object.isFrozen(g.counts) && Object.isFrozen(g.frames)));
  assert.equal(profile.begin().finish().attempts, 0);
  const error = new Error(secret), bad = createIdentityRequestProfile(() => { throw error; }), failed = bad.begin();
  assert.throws(() => bad.transport('not a URL'), e => e === error); assert.equal(failed.finish().attempts, 1);
});
test('capture failures and bounded overflow conserve all transport calls without exposing stack content', () => {
  const prior = Error.prepareStackTrace, limit = Error.stackTraceLimit;
  let calls = 0, frame = 0;
  const promise = Promise.resolve(new Response('synthetic'));
  const profile = createIdentityRequestProfile(() => { calls++; return promise; });
  try {
    Error.prepareStackTrace = () => { throw new Error('PRIVATE-CAPTURE-FAILURE'); };
    let window = profile.begin();
    assert.equal(profile.transport('https://synthetic.invalid/other'), promise);
    const failed = window.finish();
    assert.equal(failed.attempts, 1); assert.equal(failed.captureErrors, 1);
    assert.equal(failed.groups[0]!.counts.other, 1);
    Error.prepareStackTrace = () => `Error: PRIVATE\n    at PRIVATE (/Users/PRIVATE/packages/data/src/development-results.ts:${++frame}:1)`;
    window = profile.begin();
    for (let i = 0; i < 600; i++) assert.equal(profile.transport('https://synthetic.invalid/other'), promise);
    const overflow = window.finish();
    assert.equal(overflow.groups.length, 512); assert.equal(overflow.overflow, 89);
    assert.equal(overflow.attempts, 600); assert.equal(overflow.captureErrors, 0);
    assert.equal(overflow.groups.reduce((n, g) => n + g.attempts, 0), 600);
    assert.equal(overflow.groups.reduce((n, g) => n + g.counts.other, 0), 600);
    assert.equal(overflow.groups.find(g => !g.frames.length)!.attempts, 89);
    assert.equal(calls, 601); assert.equal(Error.stackTraceLimit, limit);
    assert.doesNotMatch(JSON.stringify({ failed, overflow }), /PRIVATE|Users|synthetic.invalid/);
  } finally { Error.prepareStackTrace = prior; }
});
