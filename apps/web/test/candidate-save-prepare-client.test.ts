import assert from 'node:assert/strict';
import test from 'node:test';
import { candidateSavePreviewFixture } from '../../../packages/tool-registry/test/candidate-save-preview.fixture.ts';
import { candidateSavePrepareInputSchema } from '@steer/tool-registry/candidate-save-prepare-contracts';
import { createCandidateSavePrepareClient } from '../app/candidate-save-prepare-client.ts';

async function fixture() {
  const f = await candidateSavePreviewFixture();
  const input = candidateSavePrepareInputSchema.parse({ organizationId: f.scope.organizationId, preview: f.previewInput,
    previewDigest: f.prepared.output.previewDigest, confirmation: f.prepared.output.proposedConfirmation, confirm: true });
  const output = { kind: 'steer-candidate-save-prepare/v1', input, outcome: 'unknown', reference: null,
    originalPreserved: false, readyToRequestStart: false, savedToGit: false, executionAuthorized: false, gateSigned: false };
  return { input, output };
}
test('confirmation transport is a fixed same-origin command with one request and exact input/output verification', async () => {
  const f = await fixture(); let calls = 0;
  const client = createCandidateSavePrepareClient('https://steer.test', async (url, init) => {
    calls++; assert.equal(url, 'https://steer.test/v1/tools/intent.candidate.save.prepare');
    assert.equal(init!.method, 'POST'); assert.equal(init!.credentials, 'same-origin'); assert.equal(init!.mode, 'same-origin');
    assert.equal(init!.cache, 'no-store'); assert.equal(init!.redirect, 'error'); assert.equal(init!.referrerPolicy, 'no-referrer');
    assert.deepEqual(JSON.parse(String(init!.body)), f.input); return Response.json(f.output);
  });
  assert.deepEqual(await client.prepare(f.input), f.output); assert.equal(calls, 1); client.close();
  await assert.rejects(client.prepare(f.input)); assert.equal(calls, 1);
  for (const origin of ['http://steer.test', 'https://steer.test/', 'https://user:pass@steer.test', 'https://steer.test/path'])
    assert.throws(() => createCandidateSavePrepareClient(origin));
});
test('lost, oversized, invalid and mismatched command responses never retry or imply saving', async () => {
  const f = await fixture();
  for (const mode of ['lost', 'denied', 'large', 'type', 'changed', 'saved', 'utf8']) {
    let calls = 0;
    const client = createCandidateSavePrepareClient('https://steer.test', async () => {
      calls++; if (mode === 'lost') throw new Error('PRIVATE');
      if (mode === 'denied') return Response.json({ secret: 'PRIVATE' }, { status: 403 });
      if (mode === 'large') return new Response('x'.repeat(50001), { headers: { 'content-type': 'application/json' } });
      if (mode === 'type') return new Response(JSON.stringify(f.output), { headers: { 'content-type': 'text/html' } });
      if (mode === 'utf8') return new Response(new Uint8Array([255]), { headers: { 'content-type': 'application/json' } });
      return Response.json(mode === 'changed' ? { ...f.output, input: { ...f.input, previewDigest: 'f'.repeat(64) } } : { ...f.output, savedToGit: true });
    });
    try { await assert.rejects(client.prepare(f.input), /acknowledgement could not be verified/); assert.equal(calls, 1); }
    finally { client.close(); }
  }
});
test('closing an in-flight command rejects immediately and cannot release a late acknowledgement', async () => {
  const f = await fixture(); let release!: () => void, entered!: () => void;
  const started = new Promise<void>(r => { entered = r; });
  const client = createCandidateSavePrepareClient('https://steer.test', async () => { entered(); await new Promise<void>(r => { release = r; }); return Response.json(f.output); });
  const pending = client.prepare(f.input); await started; client.close(); await assert.rejects(pending); release();
});
