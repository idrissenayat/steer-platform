import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { candidateReadFixture } from './candidate-read-fixture.ts';
import { verifyCandidateBundleRead } from '../src/candidate-bundle-read-contracts.ts';

test('portable candidate read binds exact manifest, all documents, source hashes and selected revision', async () => {
  const f = await candidateReadFixture(), result = await verifyCandidateBundleRead(f.reference, f.output);
  assert.deepEqual(result.documents, f.output.documents); assert.equal(result.manifestContent, f.output.manifestContent);
  assert.ok(Object.isFrozen(result.sources.documents)); assert.ok(Object.isFrozen(result.documents));
  assert.equal(result.executionAuthorized, false);
});
test('candidate read rejects substitutions, missing documents, authority claims and manifest-byte changes', async () => {
  const f = await candidateReadFixture();
  for (const mutate of [
    (o: typeof f.output) => { o.reference.revision = '0'.repeat(40); },
    (o: typeof f.output) => { o.manifestContent += ' '; },
    (o: typeof f.output) => { o.manifest.lineage.originatorSubject = 'invented'; },
    (o: typeof f.output) => { o.documents.brief = o.documents.brief.replace('\r\n', '\n'); },
    (o: typeof f.output) => { o.documents.exam = ''; },
    (o: typeof f.output) => { o.sources.documents.spec.blobSha = '0'.repeat(40); },
    (o: typeof f.output) => { o.sources.documents.exam.path = 'intent/0001/EXAM.md'; },
    (o: typeof f.output) => { o.executionAuthorized = true; },
    (o: typeof f.output) => { Object.assign(o, { gateSigned: true }); },
  ]) { const output = structuredClone(f.output); mutate(output); await assert.rejects(verifyCandidateBundleRead(f.reference, output)); }
  await assert.rejects(verifyCandidateBundleRead({ ...f.reference, revision: 'main' }, f.output));
  await assert.rejects(verifyCandidateBundleRead({ ...f.reference, itemId: '../0001' }, f.output));
});

test('equivalent noncanonical manifest JSON retains its exact committed bytes, not regenerated formatting', async () => {
  const f = await candidateReadFixture(), output = structuredClone(f.output);
  output.manifestContent = JSON.stringify(output.manifest);
  const digest = createHash('sha256').update(output.manifestContent).digest('hex');
  output.reference.manifestDigest = digest; output.sources.manifest.contentDigest = digest;
  output.sources.manifest.blobSha = createHash('sha1').update(`blob ${Buffer.byteLength(output.manifestContent)}\0`).update(output.manifestContent).digest('hex');
  const result = await verifyCandidateBundleRead(output.reference, output);
  assert.equal(result.manifestContent, output.manifestContent); assert.notEqual(result.manifestContent, f.output.manifestContent);
});
