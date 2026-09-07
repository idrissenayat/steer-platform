import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createDecisionReader } from '../app/decision-reader.ts';

const brief = { organizationId: 'org', repository: 'github:1', path: 'intent/0001/BRIEF.md', revision: 'a'.repeat(40), contentDigest: 'b'.repeat(64) };
const claims = { version: 'steer-gate-signature/v1', organization: 'recorded', productHome: 'https://example.invalid', item: 'synthetic', gate: 1,
  decision: 'approved', artifactRevision: brief.revision, artifacts: [{ path: brief.path, revision: brief.revision }],
  signatures: [{ subject: 'unverified', hat: 'product-lead', sequence: 1, signedAt: '2026-09-07T01:00:00Z' }] };
const content = JSON.stringify(claims);
const record = { organizationId: brief.organizationId, repository: brief.repository, kind: 'projection', path: 'intent/0001/signatures/gate-1.json',
  revision: 'c'.repeat(40), content, contentDigest: createHash('sha256').update(content).digest('hex'),
  blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex'), claims, briefLinked: true };
const output = { kind: 'brief-decisions', brief, records: [record], gateVerified: false, writeAuthorized: false };

test('decision reader fixes the exact selected Brief and uses only the read-only same-origin endpoint', async () => {
  const supplied = { ...brief };
  const reader = createDecisionReader(supplied, 'https://steer.example', async (url, init) => {
    assert.equal(url, 'https://steer.example/v1/tools/intent.brief.decisions'); assert.deepEqual(JSON.parse(init.body), brief);
    assert.equal(init.credentials, 'same-origin'); assert.equal(init.cache, 'no-store'); return Response.json(output);
  });
  supplied.revision = 'd'.repeat(40); assert.deepEqual(await reader.read(), output); reader.close(); await assert.rejects(reader.read());
});
test('decision reader rejects stale/foreign tuples, invented linkage/claims, corrupt bytes and authority assertions', async () => {
  for (const bad of [{ ...output, brief: { ...brief, revision: 'd'.repeat(40) } }, { ...output, gateVerified: true },
    { ...output, writeAuthorized: true }, { ...output, records: [record, record] },
    ...[{ organizationId: 'foreign' }, { path: 'access/authorization.json' }, { briefLinked: false },
      { claims: { ...claims, decision: 'forged' } }, { content: 'corrupt' }, { blobSha: '0'.repeat(40) }].map(change => ({ ...output, records: [{ ...record, ...change }] }))]) {
    const reader = createDecisionReader(brief, 'https://steer.example', async () => Response.json(bad));
    await assert.rejects(reader.read(), /Decision records could not be checked/); reader.close();
  }
});
test('empty and unavailable selected Brief remain distinct; closed pending reads cannot return source', async () => {
  for (const value of [null, { ...output, records: [] }]) {
    const reader = createDecisionReader(brief, 'https://steer.example', async () => Response.json(value));
    assert.deepEqual(await reader.read(), value); reader.close();
  }
  let release; const pending = new Promise(resolve => { release = resolve; });
  const reader = createDecisionReader(brief, 'https://steer.example', async () => { await pending; return Response.json(output); });
  const work = reader.read(); reader.close(); await assert.rejects(work); release();
});
