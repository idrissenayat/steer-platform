import assert from 'node:assert/strict';
import test from 'node:test';
import { createCandidateProposalClient } from '../app/candidate-proposal-client.ts';
import { candidateProposalOutputSchema } from '@steer/tool-registry/candidate-proposal-contracts';

const input = { organizationId: 'org', productId: 'product', repository: 'github:52', branch: 'codex/fixture',
  itemId: '0007-booking', revision: 'a'.repeat(40), cursor: null };
const output = { ...input, kind: 'steer-candidate-proposals/v1', treeSha: 'b'.repeat(40), entries: [], nextCursor: null,
  inventoryCount: 0, inventoryComplete: true, lifecycleVerified: false, executionAuthorized: false, savedToGit: false, gateSigned: false };
test('proposal browser client uses one strict same-origin reference query and never a save command', async () => {
  let calls = 0;
  const client = createCandidateProposalClient('https://steer.test', async (url, init) => {
    calls++; assert.equal(url, 'https://steer.test/v1/tools/intent.candidate.proposals');
    assert.deepEqual(JSON.parse(String(init!.body)), input); assert.equal(init!.credentials, 'same-origin');
    assert.equal(init!.redirect, 'error'); assert.equal(init!.cache, 'no-store'); return Response.json(output);
  });
  assert.deepEqual(await client.list(input), output);
  await assert.rejects(client.list({ ...input, consent: true } as never)); assert.equal(calls, 1); client.close();
  await assert.rejects(client.list(input)); assert.equal(calls, 1);
});
test('wrong proposal scope, false empty pages, forged authority and unreadable responses are not selectable', async () => {
  for (const response of [() => Response.json({ ...output, itemId: '0008-other' }), () => Response.json({ ...output, lifecycleVerified: true }),
    () => Response.json({ ...output, inventoryCount: 1 }), () => Response.json(output, { status: 403 }),
    () => new Response('{"PRIVATE":', { headers: { 'content-type': 'application/json' } }),
    () => new Response(new Uint8Array([255]), { headers: { 'content-type': 'application/json' } })]) {
    let calls = 0; const client = createCandidateProposalClient('https://steer.test', async () => { calls++; return response(); });
    await assert.rejects(client.list(input)); assert.equal(calls, 1); client.close();
  }
  assert.equal(candidateProposalOutputSchema.safeParse({ ...output, inventoryComplete: false }).success, false);
  assert.equal(candidateProposalOutputSchema.safeParse({ ...output, nextCursor: '11111111-1111-4111-a111-111111111111' }).success, false);
});
test('identity-context closure aborts in-flight proposal reads and cannot release late metadata', async () => {
  let release!: () => void, signal: AbortSignal | undefined, calls = 0;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const client = createCandidateProposalClient('https://steer.test', async (_url, init) => { calls++; signal = init!.signal!; await pending; return Response.json(output); });
  const request = assert.rejects(client.list(input));
  await assert.rejects(client.list(input)); assert.equal(calls, 1); client.close(); assert.equal(signal!.aborted, true);
  release(); await request; await assert.rejects(client.list(input)); assert.equal(calls, 1);
});
