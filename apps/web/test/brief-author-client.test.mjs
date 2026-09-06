import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createBriefAuthorClient, authorDraft, emptyAuthorAnswers } from '../app/brief-author-client.ts';
const scope = { organizationId: 'org', subject: 'synthetic' };
const draft = authorDraft({ ...emptyAuthorAnswers(), title: 'Original', users: 'Team A\nTeam B' });
const markdown = '# Brief: Original\n';
const output = { ...scope, kind: 'brief-preview', templateVersion: 'steer-brief/v1', markdown,
  contentDigest: createHash('sha256').update(markdown).digest('hex'), missing: ['problem'], saved: false, confirmed: false, executionAuthorized: false };
test('author client pins display identity, validates exact bytes and uses only the fixed stateless endpoint', async () => {
  const original = { ...scope }; let calls = 0;
  const client = createBriefAuthorClient(original, 'https://steer.example', async (url, init) => {
    calls++; assert.equal(url, 'https://steer.example/v1/tools/intent.brief.preview');
    assert.deepEqual(JSON.parse(init.body), { organizationId: 'org', draft });
    assert.equal(init.credentials, 'same-origin'); assert.equal(init.cache, 'no-store'); return Response.json(output);
  });
  original.organizationId = 'foreign'; assert.deepEqual(await client.preview(draft), output); assert.equal(calls, 1); client.close();
});
test('author client rejects content tampering, wrong identity, approval claims and malformed responses', async () => {
  for (const bad of [{ ...output, markdown: 'Substituted' }, { ...output, contentDigest: 'a'.repeat(64) },
    { ...output, subject: 'foreign' }, { ...output, organizationId: 'foreign' }, { ...output, saved: true },
    { ...output, confirmed: true }, { ...output, executionAuthorized: true }, { ...output, revision: 'a'.repeat(40) }, null]) {
    const client = createBriefAuthorClient(scope, 'https://steer.example', async () => Response.json(bad));
    await assert.rejects(client.preview(draft)); client.close();
  }
});
test('invalid facts fail before I/O, and failure or closure never returns private late content', async () => {
  let calls = 0; const client = createBriefAuthorClient(scope, 'https://steer.example', async () => { calls++; return Response.json(output); });
  await assert.rejects(client.preview({ ...draft, author: 'forged' })); assert.equal(calls, 0); client.close(); await assert.rejects(client.preview(draft));
  for (const status of [401, 403, 422, 500]) {
    const denied = createBriefAuthorClient(scope, 'https://steer.example', async () => new Response('private details', { status }));
    await assert.rejects(denied.preview(draft), (error) => !error.message.includes('private')); denied.close();
  }
  let release; const pending = new Promise((resolve) => { release = resolve; });
  const late = createBriefAuthorClient(scope, 'https://steer.example', async () => { await pending; return Response.json(output); });
  const result = late.preview(draft); late.close(); await assert.rejects(result); release();
});
test('answer conversion preserves unknown names, comma-containing facts and uncertainty without prototype context', () => {
  const answers = emptyAuthorAnswers(); const second = emptyAuthorAnswers(); answers.problem = 'Observed problem';
  assert.equal(second.problem, '');
  const result = authorDraft({ ...answers, users: 'Team A, B\r\n\n Team C ', systems: 'Unrecognized system', openQuestions: 'Do we know, really?' });
  assert.deepEqual(result.users, ['Team A, B', 'Team C']); assert.deepEqual(result.systems, ['Unrecognized system']);
  assert.deepEqual(result.openQuestions, ['Do we know, really?']); assert.equal(result.problem, 'Observed problem');
});
