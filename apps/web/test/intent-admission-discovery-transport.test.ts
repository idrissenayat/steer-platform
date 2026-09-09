import assert from 'node:assert/strict';
import test from 'node:test';
import { createIntentAdmissionDiscoveryTransport } from '../app/intent-admission-discovery-transport.ts';
import { admissionDiscoveryFixture } from '../../../packages/tool-registry/test/intent-admission-discovery.fixture.ts';
test('preparation diagnostics transport sends only exact references through one authenticated same-origin read', async () => {
  const f = admissionDiscoveryFixture(); let calls = 0;
  const service = createIntentAdmissionDiscoveryTransport('https://steer.test', async (url, init) => {
    calls++; assert.equal(url, 'https://steer.test/v1/tools/intent.admissions.discover'); assert.deepEqual(JSON.parse(String(init?.body)), f.input);
    assert.equal(init?.credentials, 'same-origin'); assert.equal(init?.mode, 'same-origin'); assert.equal(init?.cache, 'no-store'); assert.equal(init?.redirect, 'error');
    return Response.json(f.output);
  });
  assert.deepEqual(await service.discover(f.input), f.output); assert.equal(calls, 1); service.close(); await assert.rejects(service.discover(f.input));
});
test('preparation diagnostics transport rejects injected source, wrong cursor or owner, failure, oversized and private output', async () => {
  const f = admissionDiscoveryFixture();
  for (const body of [{ ...f.output, subject: 'private' }, { ...f.output, draftId: '00000000-0000-4000-8000-000000000009' },
    { ...f.output, entries: [{ ...f.output.entries[0], sourceText: 'private' }] }, { ...f.output, retryAuthorized: true },
    { ...f.output, private: 'p'.repeat(60001) }]) {
    const service = createIntentAdmissionDiscoveryTransport('https://steer.test', async () => Response.json(body));
    await assert.rejects(service.discover(f.input)); service.close();
  }
  for (const status of [401, 403, 503]) {
    const service = createIntentAdmissionDiscoveryTransport('https://steer.test', async () => Response.json({ private: true }, { status }));
    await assert.rejects(service.discover(f.input), e => { assert.doesNotMatch(String(e), /private/); return true; }); service.close();
  }
  assert.throws(() => createIntentAdmissionDiscoveryTransport('http://steer.test'));
});
test('preparation diagnostics has one active request and cannot release late output after close', async () => {
  const f = admissionDiscoveryFixture(); let release!: (response: Response) => void, calls = 0;
  const service = createIntentAdmissionDiscoveryTransport('https://steer.test', async () => { calls++; return new Promise<Response>(r => { release = r; }); });
  const first = assert.rejects(service.discover(f.input)); await assert.rejects(service.discover(f.input));
  service.close(); await first; release(Response.json(f.output)); await new Promise(r => setImmediate(r));
  await assert.rejects(service.discover(f.input)); assert.equal(calls, 1);
});
