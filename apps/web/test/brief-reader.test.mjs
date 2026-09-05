import assert from 'node:assert/strict';
import test from 'node:test';
import { readBriefDocument } from '@steer/domain/brief-document';
import { createBriefReader } from '../app/brief-reader.ts';
import { createReadTransport } from '../app/read-transport.ts';

const scope = { organizationId: 'org', repository: 'github:1' };
const reference = { path: 'BRIEF.md', revision: 'a'.repeat(40), contentDigest: 'b'.repeat(64) };
const catalog = { ...scope, kind: 'brief-catalog', records: [reference] };
const content = '# Brief: An outcome\n\n## Problem\n\nA problem.\n';
const detail = { ...scope, ...reference, kind: 'brief-projection', blobSha: 'c'.repeat(40), content, document: readBriefDocument(content) };

test('Brief reader fixes scope, validates shared contracts and reads only a catalog-selected exact tuple', async () => {
  const seen = []; const input = { ...scope };
  const reader = createBriefReader(input, 'https://steer.example', async (url, init) => {
    seen.push({ url, input: JSON.parse(init.body) }); return Response.json(String(url).endsWith('catalog') ? catalog : detail);
  });
  input.repository = 'github:foreign';
  const references = await reader.catalog(); references[0].revision = 'd'.repeat(40);
  assert.deepEqual(await reader.read(reference), detail);
  assert.deepEqual(seen.map((item) => item.input), [scope, { ...scope, ...reference }]);
  assert.deepEqual(seen.map((item) => item.url), ['https://steer.example/v1/tools/intent.brief.catalog', 'https://steer.example/v1/tools/intent.brief.read']);
  reader.close(); await assert.rejects(reader.catalog());
});

test('Brief reader rejects malformed, duplicate, oversized and foreign catalogs without retaining prior membership', async () => {
  for (const bad of [{ ...catalog, organizationId: 'foreign' }, { ...catalog, extra: true }, { ...catalog, records: [reference, reference] },
    { ...catalog, records: [{ ...reference, path: 'SPEC.md' }] }, { ...catalog, records: Array(1001).fill(reference) }]) {
    let output = catalog; let calls = 0;
    const reader = createBriefReader(scope, 'https://steer.example', async () => { calls++; return Response.json(output); });
    await reader.catalog(); output = bad; await assert.rejects(reader.catalog());
    await assert.rejects(reader.read(reference)); assert.equal(calls, 2); reader.close();
  }
});

test('Brief reader denies unlisted selections and foreign or stale detail responses; unavailable exact revisions remain null', async () => {
  for (const bad of [{ ...detail, repository: 'github:foreign' }, { ...detail, revision: 'd'.repeat(40) },
    { ...detail, contentDigest: 'd'.repeat(64) }, { ...detail, accessToken: 'never-render' }]) {
    let calls = 0;
    const reader = createBriefReader(scope, 'https://steer.example', async () => Response.json(++calls === 1 ? catalog : bad));
    await reader.catalog(); await assert.rejects(reader.read(reference)); reader.close();
  }
  let calls = 0;
  const reader = createBriefReader(scope, 'https://steer.example', async () => Response.json(++calls === 1 ? catalog : null));
  await reader.catalog(); assert.equal(await reader.read(reference), null);
  await assert.rejects(reader.read({ ...reference, revision: 'd'.repeat(40) })); assert.equal(calls, 2); reader.close();
});

test('Brief transport denies arbitrary tool names and closed late results, with no network authority expansion', async () => {
  let calls = 0; const transport = createReadTransport('https://steer.example', async () => { calls++; return Response.json(catalog); });
  for (const name of ['intent.create', '../auth/session', 'https://outside.example', null]) await assert.rejects(transport.request(name, scope));
  assert.equal(calls, 0); transport.close();
  let release; const pending = new Promise((resolve) => { release = resolve; });
  const reader = createBriefReader(scope, 'https://steer.example', async () => { await pending; return Response.json(catalog); });
  const work = reader.catalog(); reader.close(); await assert.rejects(work); release();
  await assert.rejects(reader.read(reference));
});
