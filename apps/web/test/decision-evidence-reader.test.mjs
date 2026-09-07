import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createDecisionEvidenceReader } from '../app/decision-evidence-reader.ts';

const brief = { organizationId: 'org', repository: 'github:1', path: 'intent/0001/BRIEF.md', revision: 'a'.repeat(40), contentDigest: 'b'.repeat(64) };
const decision = { path: 'intent/0001/signatures/gate-1.json', revision: 'c'.repeat(40), contentDigest: 'd'.repeat(64) };
const evidence = { path: 'intent/0001/EXAM.md', revision: 'a'.repeat(40) };
const input = { ...brief, decision, evidence }, content = 'Synthetic evidence\r\n';
const source = { ...evidence, organizationId: brief.organizationId, repository: brief.repository, kind: 'projection', content,
  contentDigest: createHash('sha256').update(content).digest('hex'), blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex') };
const result = { kind: 'decision-evidence', brief, decision, artifact: source, gateVerified: false, writeAuthorized: false };
test('evidence reader fixes nested references and sends only the same-origin read endpoint', async () => {
  const supplied = structuredClone(input);
  const reader = createDecisionEvidenceReader(supplied, 'https://steer.example', async (url, init) => {
    assert.equal(url, 'https://steer.example/v1/tools/intent.brief.decision.evidence'); assert.deepEqual(JSON.parse(init.body), input);
    assert.equal(init.credentials, 'same-origin'); assert.equal(init.cache, 'no-store'); return Response.json(result);
  });
  supplied.decision.revision = 'e'.repeat(40); supplied.evidence.path = 'other.md';
  assert.deepEqual(await reader.read(), result); reader.close(); await assert.rejects(reader.read());
});
test('changed contexts, forged authority and self-inconsistent evidence cannot become displayed source', async () => {
  for (const value of [{ ...result, brief: { ...brief, contentDigest: '0'.repeat(64) } }, { ...result, decision: { ...decision, revision: '0'.repeat(40) } },
    { ...result, gateVerified: true }, { ...result, writeAuthorized: true }, ...[{ path: 'other.md' }, { revision: '0'.repeat(40) }, { organizationId: 'other' },
      { content: 'changed' }, { blobSha: '0'.repeat(40) }, { content: 'x'.repeat(512 * 1024 + 1) }].map(change => ({ ...result, artifact: { ...source, ...change } }))]) {
    const reader = createDecisionEvidenceReader(input, 'https://steer.example', async () => Response.json(value));
    await assert.rejects(reader.read(), /Evidence source could not be checked/); reader.close();
  }
  assert.throws(() => createDecisionEvidenceReader({ ...input, decision: { ...decision, path: 'other.json' } }, 'https://steer.example'));
});
test('unavailable sources stay null, denied sources stay generic and closed pending reads cannot return late content', async () => {
  const absent = createDecisionEvidenceReader(input, 'https://steer.example', async () => Response.json(null));
  assert.equal(await absent.read(), null); absent.close();
  const denied = createDecisionEvidenceReader(input, 'https://steer.example', async () => Response.json({ error: 'private' }, { status: 403 }));
  await assert.rejects(denied.read(), /Evidence source could not be checked/); denied.close();
  let release; const pending = new Promise(resolve => { release = resolve; });
  const reader = createDecisionEvidenceReader(input, 'https://steer.example', async () => { await pending; return Response.json(result); });
  const work = reader.read(); reader.close(); await assert.rejects(work); release();
});
